import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock
} from 'vitest'

import { connectToTwakeSpace, type TwakeSpaceConnection } from './app.js'

const HOST = 'https://space.test'
const PREFIX = '/embed/projects/'

const posts = new WeakMap<Window, Mock>()

function fakeParent(): Window {
  const post = vi.fn()
  const parent = { postMessage: post } as unknown as Window
  posts.set(parent, post)
  return parent
}

function posted(parent: Window): unknown[][] {
  return (posts.get(parent)?.mock.calls ?? []) as unknown[][]
}

function fromHost(parent: Window, data: unknown, origin = HOST): void {
  window.dispatchEvent(
    new MessageEvent('message', { data, origin, source: parent })
  )
}

function connect(
  parent: Window,
  pathname = '/embed/projects/p1'
): TwakeSpaceConnection | null {
  window.history.replaceState(null, '', pathname)
  return connectToTwakeSpace({
    hostOrigins: [HOST],
    embedPrefix: PREFIX,
    parent
  })
}

describe('connectToTwakeSpace', () => {
  let stop: (() => void) | null = null
  afterEach(() => {
    stop?.()
    stop = null
  })

  it('does nothing out of a frame or without a host', () => {
    window.history.replaceState(null, '', '/embed/projects/p1')
    expect(
      connectToTwakeSpace({ hostOrigins: [HOST], embedPrefix: PREFIX })
    ).toBeNull()
    expect(
      connectToTwakeSpace({
        hostOrigins: [],
        embedPrefix: PREFIX,
        parent: fakeParent()
      })
    ).toBeNull()
  })

  it('holds on the callback of the login, and reports once back on the route', () => {
    const parent = fakeParent()
    const space = connect(parent, '/callback?code=1&state=s')
    if (!space) throw new Error('not connected')
    expect(space.location()).toBeNull()
    stop = space.syncHistory({ onLoad: vi.fn(), onNavigate: vi.fn() })
    expect(posted(parent)).toEqual([])

    window.history.replaceState(null, '', '/embed/projects/p1/inbox')

    expect(posted(parent)).toEqual([
      [
        {
          type: 'twake-embed:path',
          resourceId: 'p1',
          path: '/inbox',
          replace: true
        },
        HOST
      ]
    ])
  })

  it('tells TwakeSpace where it is, and about its overlay and its login', () => {
    const parent = fakeParent()
    const space = connect(parent, '/embed/projects/p1/boards/b1?task=T-1')
    if (!space) throw new Error('not connected')

    expect(space.location()).toEqual({
      resourceId: 'p1',
      path: '/boards/b1?task=T-1'
    })
    space.notifyLoginRequired()
    space.reportOverlayRegion('full')
    expect(posted(parent)).toEqual([
      [{ type: 'twake-embed:login-required' }, HOST],
      [{ type: 'twake-embed:overlay-region', region: 'full' }, HOST]
    ])
  })

  describe('syncHistory', () => {
    let parent: Window
    let space: TwakeSpaceConnection
    const handlers = {
      onLoad:
        vi.fn<(resourceId: string, path: string) => void | Promise<void>>(),
      onNavigate:
        vi.fn<(resourceId: string, path: string) => void | Promise<void>>()
    }

    beforeEach(() => {
      parent = fakeParent()
      const connected = connect(parent)
      if (!connected) throw new Error('not connected')
      space = connected
      stop = space.syncHistory(handlers)
    })

    it('reports the first URL as a replace', () => {
      expect(posted(parent)).toEqual([
        [
          {
            type: 'twake-embed:path',
            resourceId: 'p1',
            path: '',
            replace: true
          },
          HOST
        ]
      ])
    })

    it('turns a push into a replace and reports it', () => {
      const length = window.history.length

      window.history.pushState(null, '', '/embed/projects/p1/boards/b2?x=1#y')

      expect(window.history.length).toBe(length)
      expect(window.location.pathname).toBe('/embed/projects/p1/boards/b2')
      expect(posted(parent).at(-1)).toEqual([
        {
          type: 'twake-embed:path',
          resourceId: 'p1',
          path: '/boards/b2?x=1#y',
          replace: false
        },
        HOST
      ])
    })

    it('reports a replace as one', () => {
      window.history.replaceState(null, '', '/embed/projects/p1/inbox')

      expect(posted(parent).at(-1)).toEqual([
        {
          type: 'twake-embed:path',
          resourceId: 'p1',
          path: '/inbox',
          replace: true
        },
        HOST
      ])
    })

    it('reports nothing off the route', () => {
      const before = posted(parent).length
      window.history.replaceState(null, '', '/auth/callback?code=1')
      expect(posted(parent)).toHaveLength(before)
    })

    it('applies a navigate within the resource, without reporting its URL', async () => {
      handlers.onNavigate.mockImplementation(async (_id, path) => {
        await Promise.resolve()
        window.history.replaceState(null, '', `/embed/projects/p1${path}`)
      })
      const before = posted(parent).length

      fromHost(parent, {
        type: 'twake-embed:navigate',
        resourceId: 'p1',
        path: '/boards/b3'
      })
      await vi.waitFor(() => {
        expect(window.location.pathname).toBe('/embed/projects/p1/boards/b3')
      })

      expect(handlers.onNavigate).toHaveBeenCalledWith('p1', '/boards/b3')
      expect(posted(parent)).toHaveLength(before)
      // Reporting resumes afterwards
      window.history.replaceState(null, '', '/embed/projects/p1/boards/b4')
      expect(posted(parent)).toHaveLength(before + 1)
    })

    it('applies a load for another resource', () => {
      fromHost(parent, {
        type: 'twake-embed:load',
        resourceId: 'p2',
        path: '/boards/b1'
      })
      expect(handlers.onLoad).toHaveBeenCalledWith('p2', '/boards/b1')
    })

    it('drops a navigate for another resource, and anything unsafe or foreign', () => {
      fromHost(parent, {
        type: 'twake-embed:navigate',
        resourceId: 'p2',
        path: '/boards/b3'
      })
      fromHost(parent, {
        type: 'twake-embed:navigate',
        resourceId: 'p1',
        path: '/../p2'
      })
      fromHost(parent, {
        type: 'twake-embed:load',
        resourceId: 'p2',
        path: '/%2e%2e/x'
      })
      fromHost(parent, {
        type: 'twake-embed:load',
        resourceId: 'p2',
        path: 'x'
      })
      fromHost(
        parent,
        { type: 'twake-embed:load', resourceId: 'p2', path: '' },
        'https://evil.test'
      )
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'twake-embed:load', resourceId: 'p2', path: '' },
          origin: HOST,
          source: window
        })
      )
      fromHost(parent, { type: 'twake-space:theme', theme: 'dark' })

      expect(handlers.onNavigate).not.toHaveBeenCalled()
      expect(handlers.onLoad).not.toHaveBeenCalled()
    })

    it('syncs once, and stops for good', () => {
      const again = space.syncHistory(handlers)
      expect(again).toBe(stop)
      const reported = posted(parent).length

      space.disconnect()
      window.history.pushState(null, '', '/embed/projects/p1/boards/b9')

      expect(posted(parent)).toHaveLength(reported)
      expect(Object.hasOwn(window.history, 'pushState')).toBe(false)
      expect(Object.hasOwn(window.history, 'replaceState')).toBe(false)
    })
  })

  it('checks the resource id the app way', () => {
    const parent = fakeParent()
    const space = connectToTwakeSpace({
      hostOrigins: [HOST],
      embedPrefix: PREFIX,
      parent,
      isResourceId: id => /^p\d+$/.test(id)
    })
    if (!space) throw new Error('not connected')
    const onLoad = vi.fn()
    stop = space.syncHistory({ onLoad, onNavigate: vi.fn() })

    fromHost(parent, { type: 'twake-embed:load', resourceId: '../x', path: '' })
    fromHost(parent, { type: 'twake-embed:load', resourceId: 'p7', path: '' })

    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onLoad).toHaveBeenCalledWith('p7', '')
  })
})
