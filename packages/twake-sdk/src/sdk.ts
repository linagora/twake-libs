import { exchangeIdToken, refreshCredentials } from './auth'
import type { Credentials, SdkOptions, SdkStatus } from './types'

/** Default delay before a client left `waiting` falls back to `public` */
export const WAITING_TIMEOUT = 30000

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
}

export function createSdk(options: SdkOptions): Sdk {
  const { platformURL, waitingTimeout = WAITING_TIMEOUT } = options
  let credentials: Credentials | null = null
  let status: SdkStatus = 'waiting'
  let waitingTimer: ReturnType<typeof setTimeout> | null = null
  let refreshing: Promise<Credentials> | null = null
  const listeners = new Set<(status: SdkStatus) => void>()

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
    fetchJSON
  }
}
