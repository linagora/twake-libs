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

  it('reads the counts of the app for its resources', () => {
    const badges = [
      { resourceId: 'mbx-1', count: 3 },
      { resourceId: 'mbx-2', count: 0 }
    ]
    expect(parseAppMessage({ type: 'twake-embed:badges', badges })).toEqual({
      type: 'twake-embed:badges',
      badges
    })
    expect(parseAppMessage({ type: 'twake-embed:badges', badges: [] })).toEqual(
      { type: 'twake-embed:badges', badges: [] }
    )
  })

  it('refuses counts that do not fit', () => {
    const refused = (badges: unknown): void => {
      expect(parseAppMessage({ type: 'twake-embed:badges', badges })).toBeNull()
    }
    refused(undefined)
    refused({ 'mbx-1': 3 })
    refused([{ resourceId: 'mbx-1', count: -1 }])
    refused([{ resourceId: 'mbx-1', count: 1.5 }])
    refused([{ resourceId: 'mbx-1', count: '3' }])
    refused([{ resourceId: 'mbx-1', count: 1_000_001 }])
    refused([{ resourceId: '', count: 1 }])
    refused([{ resourceId: 'x'.repeat(257), count: 1 }])
    refused([{ count: 1 }])
    refused(
      Array.from({ length: 1_001 }, (_, i) => ({
        resourceId: `r${i}`,
        count: 1
      }))
    )
  })

  it('ignores anything else', () => {
    expect(parseAppMessage(null)).toBeNull()
    expect(parseAppMessage('twake-embed:path')).toBeNull()
    expect(parseAppMessage({ type: 'twake-tasks:path', path: '/x' })).toBeNull()
  })
})

describe('parseHostMessage', () => {
  it('reads hello', () => {
    expect(parseHostMessage({ type: 'twake-embed:hello' })).toEqual({
      type: 'twake-embed:hello'
    })
  })

  it('reads load and navigate', () => {
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
      parseHostMessage({ type: 'twake-space:theme', theme: 'dark' })
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
