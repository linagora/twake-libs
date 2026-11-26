import { describe, expect, it } from 'vitest'

import {
  embedRoute,
  embedUrl,
  isBelow,
  parseEmbedUrl,
  pathBelow,
  staysBelow
} from './paths.js'

const PREFIX = '/embed/projects/'

describe('isBelow', () => {
  it('takes a path below the route', () => {
    expect(isBelow('')).toBe(true)
    expect(isBelow('/boards/b1?task=T-1#x')).toBe(true)
    expect(isBelow('?q=a')).toBe(true)
    expect(isBelow('/a.b/..c/.')).toBe(true)
    expect(isBelow('/a/./b')).toBe(true)
    // A climb that stays below the route resolves to '/b'
    expect(isBelow('/a/%2e%2e/b')).toBe(true)
    expect(isBelow('/a?next=/../x')).toBe(true)
    expect(isBelow('/a b')).toBe(true)
    expect(isBelow('/café.txt')).toBe(true)
    // Only the pathname resolves above the route: the query and the hash
    // keep their spaces and controls
    expect(isBelow('/search?q=foo ')).toBe(true)
    expect(isBelow('/a#section ')).toBe(true)
    expect(isBelow('/a?b=\rc')).toBe(true)
  })

  it('refuses a path that could leave the route', () => {
    expect(isBelow('b')).toBe(false)
    expect(isBelow('/..')).toBe(false)
    expect(isBelow('/../../admin')).toBe(false)
    expect(isBelow('/../r/x')).toBe(false)
    expect(isBelow('/a/%2e%2e/%2e%2e/b')).toBe(false)
    expect(isBelow('/.%2E/b')).toBe(false)
    expect(isBelow('//host/x')).toBe(false)
    expect(isBelow('/a\\b')).toBe(false)
    // A router may decode an encoded slash or backslash before it resolves
    expect(isBelow('/..%2f..%2fadmin')).toBe(false)
    expect(isBelow('/..%2F')).toBe(false)
    expect(isBelow('/a%5cb')).toBe(false)
    // Decoded first, the dots that follow climb out: read before resolving
    expect(isBelow('/x/..%2f../..')).toBe(false)
    expect(isBelow('/a/..%5c..%5c..%5cadmin/..')).toBe(false)
    // A server may drop a path parameter, which leaves the dots
    expect(isBelow('/..;/x')).toBe(false)
    // A URL parser drops a tab or a newline, and a trailing space or control
    // character, before it reads the dots: in the whole path, or in a
    // pathname a host resolves on its own
    expect(isBelow('/.\n./x')).toBe(false)
    expect(isBelow('/.\t./x')).toBe(false)
    expect(isBelow('/\t/host/x')).toBe(false)
    expect(isBelow('/.. ')).toBe(false)
    expect(isBelow('/..\u0000')).toBe(false)
    expect(isBelow('/.. ?q=1')).toBe(false)
    // A tab or a newline in the pathname could hide an encoded slash or
    // backslash from the check, as the parser drops it
    expect(isBelow('/..%2\tf..%2\tfadmin')).toBe(false)
    expect(isBelow('/..%5\tc..%5\tcadmin')).toBe(false)
    expect(isBelow('/..%2\nF')).toBe(false)
    expect(isBelow('/..%2\rf')).toBe(false)
    expect(isBelow('/a%2\tfb')).toBe(false)
  })

  it('needs no secure context', () => {
    // An http origin other than localhost has no crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', {
      value: undefined,
      configurable: true
    })
    try {
      expect(isBelow('/boards/b1')).toBe(true)
      expect(isBelow('/../x')).toBe(false)
    } finally {
      Reflect.deleteProperty(crypto, 'randomUUID')
    }
  })
})

describe('parseEmbedUrl', () => {
  it('reads the resource id and the path below the route', () => {
    expect(parseEmbedUrl(PREFIX, '/embed/projects/p1')).toEqual({
      resourceId: 'p1',
      path: ''
    })
    expect(
      parseEmbedUrl(PREFIX, '/embed/projects/p1/boards/b1', '?task=T-1', '#x')
    ).toEqual({ resourceId: 'p1', path: '/boards/b1?task=T-1#x' })
    expect(parseEmbedUrl(PREFIX, '/embed/projects/p1', '?q=a')).toEqual({
      resourceId: 'p1',
      path: '?q=a'
    })
  })

  it('decodes the id the route encodes', () => {
    const route = embedRoute('/embed/team-mailboxes/', 'a/b@acme')
    expect(route).toBe('/embed/team-mailboxes/a%2Fb%40acme')
    expect(parseEmbedUrl('/embed/team-mailboxes/', `${route}/t/9`)).toEqual({
      resourceId: 'a/b@acme',
      path: '/t/9'
    })
  })

  it('gives null off the route', () => {
    expect(parseEmbedUrl(PREFIX, '/embed/projects/')).toBeNull()
    expect(parseEmbedUrl(PREFIX, '/boards/b1')).toBeNull()
    expect(parseEmbedUrl(PREFIX, '/embed/projects/%E0%A4%A')).toBeNull()
  })
})

describe('pathBelow', () => {
  it('gives the path below the embed route', () => {
    expect(pathBelow('/embed/projects/p1', '/embed/projects/p1')).toBe('')
    expect(pathBelow('/embed/projects/p1', '/embed/projects/p1/b?x#y')).toBe(
      '/b?x#y'
    )
  })

  it('refuses another route', () => {
    expect(pathBelow('/embed/projects/p1', '/embed/projects/p12')).toBeNull()
    expect(pathBelow('/embed/projects/p1', '/other')).toBeNull()
    expect(
      pathBelow('/embed/projects/p1', '/embed/projects/p1/../p2')
    ).toBeNull()
  })
})

describe('embedUrl', () => {
  const APP = 'https://tasks.test/'

  it('frames the resource at the path', () => {
    expect(embedUrl(APP, '/embed/projects/p1', '')).toBe(
      'https://tasks.test/embed/projects/p1'
    )
    expect(embedUrl(APP, '/embed/projects/p1', '/boards/b1?task=T-1')).toBe(
      'https://tasks.test/embed/projects/p1/boards/b1?task=T-1'
    )
  })

  it('refuses a path that leaves the route', () => {
    expect(embedUrl(APP, '/embed/projects/p1', 'x')).toBeNull()
    expect(embedUrl(APP, '/embed/projects/p1', '/../../admin')).toBeNull()
    expect(embedUrl(APP, '/embed/projects/p1', '/%2e%2e/%2e%2e/x')).toBeNull()
    expect(embedUrl(APP, '/embed/projects/p1', '/..\\x')).toBeNull()
    expect(embedUrl(APP, '/embed/projects/p1', '//evil.test/x')).toBeNull()
    expect(embedUrl(APP, '/embed/projects/p1', '/a//b')).toBeNull()
    expect(embedUrl(APP, '/embed/projects/p1', '/a\\b')).toBeNull()
    expect(embedUrl(APP, '/embed/projects/p1', '/a?next=http://x//y')).toBe(
      'https://tasks.test/embed/projects/p1/a?next=http://x//y'
    )
    expect(staysBelow('/embed/projects/p1', '/boards/b1')).toBe(true)
    expect(staysBelow('/embed/projects/p1', '/../p2')).toBe(false)
  })

  it('frames a hash route, and refuses a path that leaves it', () => {
    expect(embedUrl(APP, '/#/embed/projects/p1', '/boards/b1?x=1')).toBe(
      'https://tasks.test/#/embed/projects/p1/boards/b1?x=1'
    )
    expect(embedUrl(APP, '/#/embed/projects/p1', '/../../admin')).toBeNull()
    expect(embedUrl(APP, '/#/embed/projects/p1', '/%2e%2e/x')).toBeNull()
  })
})
