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

/** Whether `path` has the shape of a path below an embed route */
export function isBelow(path: string): boolean {
  return /^([/?#]|$)/.test(path)
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
