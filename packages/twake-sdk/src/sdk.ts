import { exchangeIdToken, refreshCredentials } from './auth'
import type {
  App,
  Context,
  Credentials,
  Flags,
  Instance,
  Intent,
  IntentRequest,
  SdkOptions,
  SdkStatus,
  Shortcut
} from './types'

/** Default delay before a client left `waiting` falls back to `public` */
export const WAITING_TIMEOUT = 30000

const HOME_SHORTCUTS_PATH = '/Settings/Home'
const STANDALONE_APPS_FLAG = 'apps.enable-standalone-apps'
const HIDDEN_APPS_FLAG = 'apps.hidden'

export class SdkError extends Error {
  readonly status: number

  constructor(path: string, status: number) {
    super(`[twake-sdk] ${path} failed: ${status}`)
    this.name = 'SdkError'
    this.status = status
  }
}

export interface Sdk {
  readonly platformURL: string
  readonly status: SdkStatus
  /** @returns a function that stops listening */
  onStatusChange(listener: (status: SdkStatus) => void): () => void
  /** Exchanges the id token, resolves once the client is `ready` */
  login(idToken: string): Promise<void>
  /** Forgets the credentials: cannot fail, the SSO ends the OAuth client itself */
  logout(): void
  /** `window.fetch` on the platform: base URL, bearer, 401 refreshed once */
  fetch(path: string, init?: RequestInit): Promise<Response>
  fetchJSON<T>(path: string, init?: RequestInit): Promise<T>
  /** Installed apps, without the ones hidden by the `apps.hidden` flag */
  getApps(): Promise<App[]>
  /** Installed apps, hidden ones included */
  getAllApps(): Promise<App[]>
  /** The instance, with its disk usage when the app may read it */
  getInstance(): Promise<Instance>
  getContext(): Promise<Context>
  getFlags(): Promise<Flags>
  /** Shortcuts of the Home folder */
  getShortcuts(): Promise<Shortcut[]>
  /** Blob URL of the app icon, revoked by `logout` */
  getAppIconURL(slug: string): Promise<string>
  /**
   * URL of an installed app, hidden or not, null otherwise. Standalone apps
   * open at their client URL
   */
  getAppURL(slug: string, path?: string): Promise<string | null>
  createIntent(request: IntentRequest): Promise<Intent>
}

interface JsonApiDoc<A> {
  id: string
  type: string
  attributes: A
  links?: Record<string, string>
}

interface JsonApiResponse<D, I = Record<string, unknown>> {
  data: D
  included?: JsonApiDoc<I>[]
}

interface FileAttributes {
  name: string
  class?: string
  metadata?: { icon?: string; iconMimeType?: string }
}

/**
 * Without an icon mime type the icon is a plain SVG, otherwise it comes from
 * the Iconizer API already in base64
 */
const shortcutIcon = ({ metadata }: FileAttributes): string | null => {
  if (!metadata?.icon) return null
  return metadata.iconMimeType
    ? `data:${metadata.iconMimeType};base64,${metadata.icon}`
    : `data:image/svg+xml;base64,${btoa(metadata.icon)}`
}

interface DiskUsageAttributes {
  used: string
  quota?: string
}

const isHttpURL = (value: unknown): value is string =>
  typeof value === 'string' && /^https?:\/\//.test(value)

const flatten = <A extends object>(
  doc: JsonApiDoc<A>
): A & { id: string; links: Record<string, string> } => ({
  ...doc.attributes,
  id: doc.id,
  links: doc.links ?? {}
})

export function createSdk(options: SdkOptions): Sdk {
  const { platformURL, waitingTimeout = WAITING_TIMEOUT } = options
  let credentials: Credentials | null = null
  let status: SdkStatus = 'waiting'
  let waitingTimer: ReturnType<typeof setTimeout> | null = null
  let refreshing: Promise<Credentials> | null = null
  const listeners = new Set<(status: SdkStatus) => void>()
  // Platform data for the page lifetime, keyed by request path
  const cache = new Map<string, Promise<unknown>>()
  const iconURLs = new Map<string, Promise<string>>()

  const setStatus = (next: SdkStatus): void => {
    if (waitingTimer) clearTimeout(waitingTimer)
    waitingTimer = null
    if (next === 'waiting') {
      waitingTimer = setTimeout(() => setStatus('public'), waitingTimeout)
    }
    if (next === status) return
    status = next
    for (const listener of listeners) listener(status)
  }

  const login = async (idToken: string): Promise<void> => {
    if (!credentials) setStatus('waiting')
    try {
      credentials = await exchangeIdToken(platformURL, idToken)
    } catch (err: unknown) {
      if (!credentials) setStatus('public')
      throw err
    }
    setStatus('ready')
  }

  const logout = (): void => {
    credentials = null
    refreshing = null
    cache.clear()
    for (const url of iconURLs.values()) {
      url.then(value => URL.revokeObjectURL(value)).catch(() => null)
    }
    iconURLs.clear()
    setStatus('public')
  }

  const refresh = (): Promise<Credentials> => {
    // Concurrent 401s share one refresh
    if (!refreshing) {
      const current = credentials
      if (!current) return Promise.reject(new SdkError('access_token', 401))
      refreshing = refreshCredentials(platformURL, current)
        .then(next => {
          credentials = next
          return next
        })
        .catch((err: unknown) => {
          logout()
          throw err
        })
        .finally(() => {
          refreshing = null
        })
    }
    return refreshing
  }

  const send = (
    path: string,
    init: RequestInit,
    token: string
  ): Promise<Response> => {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return fetch(new URL(path, platformURL), { ...init, headers })
  }

  const sdkFetch = async (
    path: string,
    init: RequestInit = {}
  ): Promise<Response> => {
    if (!credentials) throw new SdkError(path, 401)
    const response = await send(path, init, credentials.accessToken)
    if (response.status !== 401) return response
    const next = await refresh()
    return send(path, init, next.accessToken)
  }

  const fetchJSON = async <T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> => {
    const headers = new Headers(init.headers)
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')
    const response = await sdkFetch(path, { ...init, headers })
    if (!response.ok) throw new SdkError(path, response.status)
    return (await response.json()) as T
  }

  const cached = <T>(path: string, load: () => Promise<T>): Promise<T> => {
    let pending = cache.get(path) as Promise<T> | undefined
    if (!pending) {
      pending = load().catch((err: unknown) => {
        cache.delete(path)
        throw err
      })
      cache.set(path, pending)
    }
    return pending
  }

  const getFlags = (): Promise<Flags> =>
    cached('/settings/flags', async () => {
      const { data } =
        await fetchJSON<JsonApiResponse<JsonApiDoc<Flags>>>('/settings/flags')
      return data.attributes
    })

  const getAllApps = (): Promise<App[]> =>
    cached('/apps/', async () => {
      const { data } =
        await fetchJSON<JsonApiResponse<JsonApiDoc<App>[]>>('/apps/')
      return data.map(flatten)
    })

  const getApps = async (): Promise<App[]> => {
    const [apps, flags] = await Promise.all([getAllApps(), getFlags()])
    const hidden = flags[HIDDEN_APPS_FLAG]
    const hiddenSlugs = Array.isArray(hidden) ? hidden : []
    return apps.filter(app => !hiddenSlugs.includes(app.slug))
  }

  const getInstance = (): Promise<Instance> =>
    cached('/settings/instance', async () => {
      const [instance, diskUsage] = await Promise.all([
        fetchJSON<JsonApiResponse<JsonApiDoc<Record<string, unknown>>>>(
          '/settings/instance'
        ),
        // Its own permission: an app without it still has an instance
        fetchJSON<JsonApiResponse<JsonApiDoc<DiskUsageAttributes>>>(
          '/settings/disk-usage'
        ).catch(() => null)
      ])
      const { used, quota } = diskUsage?.data.attributes ?? {}
      return {
        ...instance.data.attributes,
        diskUsage: used ? Number(used) : null,
        diskQuota: quota ? Number(quota) : null
      }
    })

  const getContext = (): Promise<Context> =>
    cached('/settings/context', async () => {
      const { data } =
        await fetchJSON<JsonApiResponse<JsonApiDoc<Context>>>(
          '/settings/context'
        )
      return data.attributes
    })

  const getShortcuts = (): Promise<Shortcut[]> =>
    cached('/shortcuts', async () => {
      const path = `/files/metadata?Path=${encodeURIComponent(HOME_SHORTCUTS_PATH)}`
      let included: JsonApiDoc<FileAttributes>[]
      try {
        ;({ included = [] } =
          await fetchJSON<
            JsonApiResponse<JsonApiDoc<FileAttributes>, FileAttributes>
          >(path))
      } catch (err: unknown) {
        // No Home folder yet: no shortcuts
        if (err instanceof SdkError && err.status === 404) return []
        throw err
      }
      const files = included.filter(
        file => file.attributes.class === 'shortcut'
      )
      return Promise.all(
        files.map(async file => {
          const { data } = await fetchJSON<
            JsonApiResponse<JsonApiDoc<{ name: string; url: string }>>
          >(`/shortcuts/${file.id}`)
          return {
            id: file.id,
            name: data.attributes.name,
            url: data.attributes.url,
            icon: shortcutIcon(file.attributes)
          }
        })
      )
    })

  const getAppIconURL = (slug: string): Promise<string> => {
    let pending = iconURLs.get(slug)
    if (!pending) {
      pending = sdkFetch(`/apps/${slug}/icon`).then(async response => {
        if (!response.ok)
          throw new SdkError(`/apps/${slug}/icon`, response.status)
        return URL.createObjectURL(await response.blob())
      })
      pending.catch(() => iconURLs.delete(slug))
      iconURLs.set(slug, pending)
    }
    return pending
  }

  const getAppURL = async (slug: string, path = ''): Promise<string | null> => {
    const [apps, flags] = await Promise.all([getAllApps(), getFlags()])
    const app = apps.find(candidate => candidate.slug === slug)
    if (!app) return null
    let base = app.links.related
    if (
      app.standalone === true &&
      app.client_url_flag &&
      flags[STANDALONE_APPS_FLAG]
    ) {
      const clientURL = flags[app.client_url_flag]
      if (isHttpURL(clientURL)) base = clientURL
    }
    if (!base) return null
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  }

  const createIntent = async (request: IntentRequest): Promise<Intent> => {
    const { data } = await fetchJSON<JsonApiResponse<JsonApiDoc<Intent>>>(
      '/intents',
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json'
        },
        body: JSON.stringify({
          data: { type: 'io.cozy.intents', attributes: request }
        })
      }
    )
    return flatten(data)
  }

  setStatus('waiting')
  if (options.idToken) login(options.idToken).catch(() => null)

  return {
    platformURL,
    get status(): SdkStatus {
      return status
    },
    onStatusChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    login,
    logout,
    fetch: sdkFetch,
    fetchJSON,
    getApps,
    getAllApps,
    getInstance,
    getContext,
    getFlags,
    getShortcuts,
    getAppIconURL,
    getAppURL,
    createIntent
  }
}
