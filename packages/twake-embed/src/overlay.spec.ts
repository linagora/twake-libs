import { describe, expect, it } from 'vitest'

import { computeOverlayRegion, connectSpaceOverlay } from './overlay.js'

describe('connectSpaceOverlay', () => {
  it('does nothing out of a frame, or in a frame without a name', () => {
    expect(connectSpaceOverlay(() => undefined)).toBeNull()
  })
})

describe('computeOverlayRegion', () => {
  it('shows everything while a modal is open', () => {
    document.body.innerHTML = '<div class="MuiModal-root"><p>Dialog</p></div>'
    expect(computeOverlayRegion(document)).toBe('full')
    document.body.innerHTML = ''
  })

  it('shows nothing of an empty overlay', () => {
    document.body.innerHTML = ''
    expect(computeOverlayRegion(document)).toEqual([])
  })

  it('looks through what neither paints nor takes clicks', () => {
    document.body.innerHTML =
      '<div style="pointer-events: none"><span>dock</span></div>'
    // jsdom lays nothing out: every box is empty, so nothing is reported
    expect(computeOverlayRegion(document)).toEqual([])
    document.body.innerHTML = ''
  })
})
