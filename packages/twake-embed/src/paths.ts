// Paths around an embed route. An app frames one resource at
// `<prefix><resource id>` (`/embed/projects/<id>` in Tasks,
// `/embed/team-mailboxes/<id>` in Mail), and everything the frame shows is a
// path below that route: '' on the route itself, otherwise the rest of the
// URL, starting with '/', '?' or '#'.

export interface EmbedLocation {
  resourceId: string
  /** Below the embed route: '' or starting with '/', '?' or '#' */
  path: string
}

/**
 * Whether `path` has the shape of a path below an embed route: '' or a path
 * starting with '/', '?' or '#' that stays below the route once a URL parser
 * resolves it. The parser drops a trailing space or control and reads `..` in
 * every encoding, so resolving covers them. An encoded slash or backslash
 * (`%2f`, `%5c`) is refused in the pathname, as a router may decode them
 * before it resolves; so are a backslash, and a tab or a newline, which the
 * parser drops and which could so hide an encoding; and a double slash,
 * which a router may read as another host.
 */
export function isBelow(path: string): boolean {
  if (!/^([/?#]|$)/.test(path)) return false
  const pathname = path.split(/[?#]/, 1)[0] ?? ''
  if (/[\t\n\r\\]|%2f|%5c/i.test(pathname)) return false
  // The whole path, and the pathname alone without its parameters (`..;x`),
  // as a server that drops them or a host that resolves only the pathname
  // would read it
  return [path, pathname.replace(/;[^/]*/g, '')].every(staysBelowRoot)
}

/**
 * Resolved as a URL below two roots, the path must stay below both: a `..`
 * that climbs out of one lands at the same place from the other, so nothing
 * brings it back below both
 */
function staysBelowRoot(path: string): boolean {
  return ['/a', '/b'].every(root => {
    let url: URL
    try {
      url = new URL(`https://embed.invalid${root}${path}`)
    } catch {
      return false
    }
    if (!url.pathname.startsWith(root)) return false
    const below = url.pathname.slice(root.length)
    return (below === '' || below.startsWith('/')) && !below.includes('//')
  })
}

/** The embed route of a resource under `prefix` ('/embed/projects/') */
export function embedRoute(prefix: string, resourceId: string): string {
  return prefix + encodeURIComponent(resourceId)
}

/**
 * The path below `embedPath` in a frame path, null when the frame path is
 * not on that route ('/embed/projects/p12' is not below '/embed/projects/p1')
 */
export function pathBelow(embedPath: string, framePath: string): string | null {
  if (!framePath.startsWith(embedPath)) return null
  const below = framePath.slice(embedPath.length)
  return isBelow(below) ? below : null
}

/**
 * The resource id and the path below the route in a URL under `prefix`, null
 * elsewhere. The id segment is URL decoded, as `embedRoute` encodes it.
 */
export function parseEmbedUrl(
  prefix: string,
  pathname: string,
  search = '',
  hash = ''
): EmbedLocation | null {
  if (!pathname.startsWith(prefix)) return null
  const rest = pathname.slice(prefix.length)
  const slash = rest.indexOf('/')
  const segment = slash === -1 ? rest : rest.slice(0, slash)
  if (segment === '') return null
  let resourceId: string
  try {
    resourceId = decodeURIComponent(segment)
  } catch {
    return null
  }
  const below = slash === -1 ? '' : rest.slice(slash)
  return { resourceId, path: below + search + hash }
}

/**
 * The URL of a frame on `embedPath` at `path`, null when `path` leaves the
 * route once resolved: '..', '%2e%2e', '//host' or another origin. `path`
 * comes from the address bar or from a message, so anyone can write it.
 */
export function embedUrl(
  appUrl: string,
  embedPath: string,
  path: string
): string | null {
  if (!isBelow(path)) return null
  // A hash route ('/#/embed/projects/p1'): a URL keeps its fragment as
  // written, so the route in it is resolved on its own
  const fragment = embedPath.indexOf('#')
  if (
    fragment !== -1 &&
    embedUrl(appUrl, embedPath.slice(fragment + 1), path) === null
  ) {
    return null
  }
  let url: URL
  try {
    url = new URL(embedPath + path, appUrl)
  } catch {
    return null
  }
  if (url.origin !== new URL(appUrl).origin) return null
  return pathBelow(embedPath, url.pathname + url.search + url.hash) === null
    ? null
    : url.href
}

/** Whether `path` stays below `embedPath` once resolved */
export function staysBelow(embedPath: string, path: string): boolean {
  return embedUrl('https://embed.invalid/', embedPath, path) !== null
}
