import { describe, expect, it } from 'vitest'

import {
  embedRoute,
  embedUrl,
  parseEmbedUrl,
  pathBelow,
  staysBelow
} from './paths.js'

const PREFIX = '/embed/projects/'

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
