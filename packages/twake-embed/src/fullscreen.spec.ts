import { describe, expect, it, vi } from 'vitest'

import {
  canGoFullscreen,
  exitFullscreen,
  requestFullscreen
} from './fullscreen.js'

describe("the browser's full screen", () => {
  it('is out of reach when the browser or TwakeSpace did not grant it', () => {
    // jsdom grants nothing, as a frame without `allow="fullscreen"`
    expect(canGoFullscreen()).toBe(false)
  })

  it('asks the browser for the element, the whole app by default', async () => {
    const request = vi.fn(() => Promise.resolve())
    document.documentElement.requestFullscreen = request
    const box = document.createElement('div')
    box.requestFullscreen = request

    await requestFullscreen()
    await requestFullscreen(box)

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('leaves the full screen only when in it', async () => {
    const exit = vi.fn(() => Promise.resolve())
    const inside = {
      fullscreenElement: null,
      exitFullscreen: exit
    } as unknown as Document
    await exitFullscreen(inside)
    expect(exit).not.toHaveBeenCalled()

    const shown = {
      fullscreenElement: document.body,
      exitFullscreen: exit
    } as unknown as Document
    await exitFullscreen(shown)
    expect(exit).toHaveBeenCalledOnce()
  })
})
