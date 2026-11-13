/** The window event that asks the dialog to check the served build at once */
export const CHECK_VERSION_EVENT = 'twake:check-version'

/**
 * Asks for a check now: call it when a lazy chunk fails to load, the usual
 * sign of a tab running an older build than the served one
 */
export const requestVersionCheck = (): void => {
  window.dispatchEvent(new Event(CHECK_VERSION_EVENT))
}

/**
 * The id of the build the server serves now, read in `{ "build": "…" }`.
 * Null when it cannot tell: an error, the network, or a page that is not that
 * JSON (a dev server answers index.html for any path)
 */
export const fetchServedBuild = async (
  url = '/version.json',
  fetchFn: typeof fetch = fetch
): Promise<string | null> => {
  try {
    const response = await fetchFn(url, { cache: 'no-store' })
    if (!response.ok) return null
    const body: unknown = await response.json()
    const build = (body as { build?: unknown } | null)?.build
    return typeof build === 'string' && build !== '' ? build : null
  } catch {
    return null
  }
}

/** True when the server serves a build other than the one running here */
export const isNewBuild = (
  running: string,
  served: string | null
): served is string => served !== null && served !== '' && served !== running
