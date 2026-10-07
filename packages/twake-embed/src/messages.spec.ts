import { describe, expect, it } from 'vitest'

import {
  parseAppMessage,
  parseHostMessage,
  parseOverlayRegion
} from './messages.js'

describe('parseAppMessage', () => {
  it('reads a path, replaced unless said otherwise', () => {
    expect(
      parseAppMessage({
        type: 'twake-embed:path',
        resourceId: 'p1',
        path: '/b',
        replace: false
      })
    ).toEqual({
      type: 'twake-embed:path',
      resourceId: 'p1',
      path: '/b',
      replace: false
    })
    expect(
      parseAppMessage({ type: 'twake-embed:path', resourceId: 'p1', path: '' })
    ).toMatchObject({ replace: true })
  })

  it('refuses a path off the route or a missing id', () => {
    expect(
      parseAppMessage({ type: 'twake-embed:path', resourceId: 'p1', path: 'b' })
    ).toBeNull()
    expect(
      parseAppMessage({ type: 'twake-embed:path', resourceId: '', path: '/b' })
    ).toBeNull()
    expect(parseAppMessage({ type: 'twake-embed:path', path: '/b' })).toBeNull()
  })

  it('reads the login and overlay messages', () => {
    expect(parseAppMessage({ type: 'twake-embed:login-required' })).toEqual({
      type: 'twake-embed:login-required'
    })
    expect(
      parseAppMessage({ type: 'twake-embed:overlay-region', region: 'full' })
    ).toEqual({ type: 'twake-embed:overlay-region', region: 'full' })
    expect(
      parseAppMessage({ type: 'twake-embed:overlay-region', region: 'half' })
    ).toBeNull()
  })

  it('reads a request for the whole page of TwakeSpace', () => {
    expect(
      parseAppMessage({ type: 'twake-embed:fill-page', fill: true })
    ).toEqual({ type: 'twake-embed:fill-page', fill: true })
    expect(
      parseAppMessage({ type: 'twake-embed:fill-page', fill: 'yes' })
    ).toBeNull()
  })

  it('ignores anything else', () => {
    expect(parseAppMessage(null)).toBeNull()
    expect(parseAppMessage('twake-embed:path')).toBeNull()
    expect(parseAppMessage({ type: 'twake-tasks:path', path: '/x' })).toBeNull()
  })
})

describe('parseHostMessage', () => {
  it('reads load, navigate and theme', () => {
    expect(
      parseHostMessage({ type: 'twake-embed:load', resourceId: 'p2', path: '' })
    ).toEqual({ type: 'twake-embed:load', resourceId: 'p2', path: '' })
    expect(
      parseHostMessage({
        type: 'twake-embed:navigate',
        resourceId: 'p1',
        path: '?q=a'
      })
    ).toEqual({ type: 'twake-embed:navigate', resourceId: 'p1', path: '?q=a' })
    expect(
      parseHostMessage({ type: 'twake-space:theme', theme: 'dark' })
    ).toEqual({ type: 'twake-space:theme', theme: 'dark' })
  })

  it('refuses what does not fit', () => {
    expect(
      parseHostMessage({
        type: 'twake-embed:load',
        resourceId: 'p2',
        path: 'x'
      })
    ).toBeNull()
    expect(
      parseHostMessage({
        type: 'twake-embed:navigate',
        resourceId: 1,
        path: '/'
      })
    ).toBeNull()
    expect(
      parseHostMessage({ type: 'twake-space:theme', theme: 'blue' })
    ).toBeNull()
    expect(
      parseHostMessage({ type: 'twake-embed:path', resourceId: 'p1', path: '' })
    ).toBeNull()
  })
})

describe('parseOverlayRegion', () => {
  it('bounds the boxes', () => {
    expect(parseOverlayRegion([{ x: 1, y: 2, width: 3, height: 4 }])).toEqual([
      { x: 1, y: 2, width: 3, height: 4 }
    ])
    expect(parseOverlayRegion([])).toEqual([])
    expect(
      parseOverlayRegion([{ x: 1, y: 2, width: -3, height: 4 }])
    ).toBeNull()
    expect(
      parseOverlayRegion([{ x: 1e9, y: 2, width: 3, height: 4 }])
    ).toBeNull()
    expect(
      parseOverlayRegion([{ x: 'a', y: 2, width: 3, height: 4 }])
    ).toBeNull()
    expect(
      parseOverlayRegion(
        Array.from({ length: 33 }, () => ({ x: 0, y: 0, width: 1, height: 1 }))
      )
    ).toBeNull()
  })
})
