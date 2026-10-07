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

// What the app posted, apart from asking for the greeting
function posted(parent: Window): unknown[][] {
  return ((posts.get(parent)?.mock.calls ?? []) as unknown[][]).filter(
    ([data]) => (data as { type: string }).type !== 'twake-embed:ready'
  )
}

function asked(parent: Window): number {
  return ((posts.get(parent)?.mock.calls ?? []) as unknown[][]).filter(
    ([data, target]) =>
      (data as { type: string }).type === 'twake-embed:ready' && target === '*'
  ).length
}

function fromHost(parent: Window, data: unknown, origin = HOST): void {
  window.dispatchEvent(
    new MessageEvent('message', { data, origin, source: parent })
  )
}

const hello = { type: 'twake-embed:hello' }

function connect(
  parent: Window,
  pathname = '/embed/projects/p1',
  hostOrigins?: string[]
): TwakeSpaceConnection | null {
  window.history.replaceState(null, '', pathname)
  return connectToTwakeSpace({ embedPrefix: PREFIX, parent, hostOrigins })
}

describe('connectToTwakeSpace', () => {
  let space: TwakeSpaceConnection | null = null
  afterEach(() => {
    space?.disconnect()
    space = null
  })

  it('does nothing out of a frame, or with no host allowed', () => {
    window.history.replaceState(null, '', '/embed/projects/p1')
    expect(connectToTwakeSpace({ embedPrefix: PREFIX })).toBeNull()
    expect(connect(fakeParent(), '/embed/projects/p1', [])).toBeNull()
  })

  it('asks whoever framed it for the greeting, until it comes', () => {
    const parent = fakeParent()
    space = connect(parent)
    if (!space) throw new Error('not connected')
    expect(asked(parent)).toBe(1)

    space.syncHistory({ onLoad: vi.fn(), onNavigate: vi.fn() })
    expect(asked(parent)).toBe(2)

    fromHost(parent, hello)
    space.disconnect()
    space = connect(parent)
    if (!space) throw new Error('not connected')
    fromHost(parent, hello)
    space.syncHistory({ onLoad: vi.fn(), onNavigate: vi.fn() })
    // Greeted already: no need to ask again
    expect(asked(parent)).toBe(3)
  })

  it('says nothing until the host greets it, then answers that host', () => {
    const parent = fakeParent()
    space = connect(parent, '/embed/projects/p1/boards/b1?task=T-1')
    if (!space) throw new Error('not connected')
    space.notifyLoginRequired()
    space.reportOverlayRegion('full')
    space.fillPage(true)
    expect(posted(parent)).toEqual([])
    expect(space.hostOrigin()).toBeNull()

    fromHost(parent, hello, 'https://another-space.test')
    expect(space.hostOrigin()).toBe('https://another-space.test')
    space.notifyLoginRequired()
    space.reportOverlayRegion('full')
    space.fillPage(true)
    expect(posted(parent)).toEqual([
      [{ type: 'twake-embed:login-required' }, 'https://another-space.test'],
      [
        { type: 'twake-embed:overlay-region', region: 'full' },
        'https://another-space.test'
      ],
      [
        { type: 'twake-embed:fill-page', fill: true },
        'https://another-space.test'
      ]
    ])
  })

  it('learns the host from any of its messages, never from another window', () => {
    const parent = fakeParent()
    space = connect(parent)
    if (!space) throw new Error('not connected')

    window.dispatchEvent(
      new MessageEvent('message', { data: hello, origin: HOST, source: window })
    )
    fromHost(parent, { type: 'not-twake' })
    expect(space.hostOrigin()).toBeNull()

    fromHost(parent, { type: 'twake-space:theme', theme: 'dark' })
    expect(space.hostOrigin()).toBe(HOST)
  })

  it('reports the counts, and the last ones again to a host that greets later', () => {
    const parent = fakeParent()
    const space = connect(parent)
    const badges = [{ resourceId: 'p1', count: 2 }]

    space?.reportBadges(badges)
    expect(posted(parent)).toEqual([])

    fromHost(parent, hello)
    expect(posted(parent)).toContainEqual([
      { type: 'twake-embed:badges', badges },
      HOST
    ])

    space?.reportBadges([])
    expect(posted(parent).at(-1)).toEqual([
      { type: 'twake-embed:badges', badges: [] },
      HOST
    ])
    space?.disconnect()
  })

  it('keeps to the hosts given, when some are', () => {
    const parent = fakeParent()
    space = connect(parent, '/embed/projects/p1', [HOST])
    if (!space) throw new Error('not connected')

    fromHost(parent, hello, 'https://evil.test')
    expect(space.hostOrigin()).toBeNull()
    fromHost(parent, hello)
    expect(space.hostOrigin()).toBe(HOST)
  })

  describe('syncHistory', () => {
    let parent: Window
    let stop: () => void
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
      fromHost(parent, hello)
    })

    it('reports the URL as a replace once the host greets it', () => {
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

    it('reports the URL again to a new document greeted again', () => {
      // The frame reloaded (the silent login): the host greets the new
      // document, from the same origin
      fromHost(parent, hello)
      expect(posted(parent)).toHaveLength(1)

      fromHost(parent, hello, 'https://moved.test')
      expect(posted(parent).at(-1)).toEqual([
        { type: 'twake-embed:path', resourceId: 'p1', path: '', replace: true },
        'https://moved.test'
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

    it('reports a replace as one, and nothing off the route', () => {
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
        path: '//x'
      })
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'twake-embed:load', resourceId: 'p2', path: '' },
          origin: HOST,
          source: window
        })
      )

      expect(handlers.onNavigate).not.toHaveBeenCalled()
      expect(handlers.onLoad).not.toHaveBeenCalled()
    })

    it('syncs once, and stops for good', () => {
      if (!space) throw new Error('not connected')
      expect(space.syncHistory(handlers)).toBe(stop)
      const reported = posted(parent).length

      space.disconnect()
      window.history.pushState(null, '', '/embed/projects/p1/boards/b9')
      fromHost(parent, { type: 'twake-embed:load', resourceId: 'p3', path: '' })

      expect(posted(parent)).toHaveLength(reported)
      expect(handlers.onLoad).not.toHaveBeenCalled()
      expect(Object.hasOwn(window.history, 'pushState')).toBe(false)
      expect(Object.hasOwn(window.history, 'replaceState')).toBe(false)
    })
  })

  it('holds on the callback of the login, and reports once back on the route', () => {
    const parent = fakeParent()
    space = connect(parent, '/callback?code=1&state=s')
    if (!space) throw new Error('not connected')
    expect(space.location()).toBeNull()
    space.syncHistory({ onLoad: vi.fn(), onNavigate: vi.fn() })
    fromHost(parent, hello)
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

  it('checks the resource id the app way', () => {
    const parent = fakeParent()
    window.history.replaceState(null, '', '/embed/projects/p1')
    space = connectToTwakeSpace({
      embedPrefix: PREFIX,
      parent,
      isResourceId: id => /^p\d+$/.test(id)
    })
    if (!space) throw new Error('not connected')
    const onLoad = vi.fn()
    space.syncHistory({ onLoad, onNavigate: vi.fn() })

    fromHost(parent, { type: 'twake-embed:load', resourceId: '../x', path: '' })
    fromHost(parent, { type: 'twake-embed:load', resourceId: 'p7', path: '' })

    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onLoad).toHaveBeenCalledWith('p7', '')
  })
})
