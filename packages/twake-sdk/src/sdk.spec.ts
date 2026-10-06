import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSdk, SdkError, type Sdk } from './sdk'
import {
  CREDENTIALS,
  PLATFORM_URL,
  authorizationOf,
  json,
  requestsTo,
  stubFetch
} from './testUtils'

const EXCHANGE = { '/auth/token_exchange': (): Response => json(CREDENTIALS) }

const APPS = {
  data: [
    {
      id: 'io.cozy.apps/home',
      type: 'io.cozy.apps',
      attributes: { slug: 'home', name: 'Home', state: 'ready' },
      links: { related: 'https://alice-home.twake.example/' }
    },
    {
      id: 'io.cozy.apps/calendar',
      type: 'io.cozy.apps',
      attributes: {
        slug: 'calendar',
        name: 'Calendar',
        state: 'ready',
        standalone: true,
        client_url_flag: 'calendar.client-url'
      },
      links: { related: 'https://alice-calendar.twake.example/' }
    },
    {
      id: 'io.cozy.apps/hidden',
      type: 'io.cozy.apps',
      attributes: { slug: 'hidden', name: 'Hidden', state: 'ready' },
      links: {}
    }
  ]
}

const loggedIn = async (
  routes: Parameters<typeof stubFetch>[0] = {}
): Promise<{ sdk: Sdk; fetchMock: ReturnType<typeof stubFetch> }> => {
  const fetchMock = stubFetch({ ...EXCHANGE, ...routes })
  const sdk = createSdk({ platformURL: PLATFORM_URL })
  await sdk.login('id-token')
  return { sdk, fetchMock }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('status', () => {
  it('waits for credentials, then falls back to public', () => {
    stubFetch({})
    const sdk = createSdk({ platformURL: PLATFORM_URL, waitingTimeout: 1000 })
    const onChange = vi.fn()
    sdk.onStatusChange(onChange)

    expect(sdk.status).toBe('waiting')
    vi.advanceTimersByTime(1000)
    expect(sdk.status).toBe('public')
    expect(onChange).toHaveBeenCalledWith('public')
  })

  it('is ready once the id token is exchanged', async () => {
    const { sdk } = await loggedIn()

    expect(sdk.status).toBe('ready')
  })

  it('falls back to public and rejects when the first exchange fails', async () => {
    stubFetch({ '/auth/token_exchange': () => json({}, 403) })
    const sdk = createSdk({ platformURL: PLATFORM_URL })

    await expect(sdk.login('id-token')).rejects.toThrow('token_exchange')
    expect(sdk.status).toBe('public')
  })

  it('stays ready when a later exchange fails', async () => {
    const { sdk, fetchMock } = await loggedIn()
    fetchMock.mockResolvedValue(json({}, 403))

    await expect(sdk.login('renewed')).rejects.toThrow('token_exchange')
    expect(sdk.status).toBe('ready')
  })

  it('logs out to public', async () => {
    const { sdk } = await loggedIn()

    sdk.logout()

    expect(sdk.status).toBe('public')
    await expect(sdk.fetch('/apps/')).rejects.toEqual(
      new SdkError('/apps/', 401)
    )
  })
})

describe('fetch', () => {
  it('sends the bearer token to the platform', async () => {
    const { sdk, fetchMock } = await loggedIn({ '/apps/': () => json(APPS) })

    const response = await sdk.fetch('/apps/')

    expect(response.status).toBe(200)
    const [url, init] = fetchMock.mock.calls.at(-1) as [URL, RequestInit]
    expect(url.href).toBe(`${PLATFORM_URL}/apps/`)
    expect(authorizationOf(init)).toBe('Bearer access-1')
  })

  it('refreshes the token once on 401 and retries', async () => {
    const { sdk, fetchMock } = await loggedIn({
      '/apps/': (_url, init) =>
        authorizationOf(init) === 'Bearer access-2'
          ? json(APPS)
          : json({}, 401),
      '/auth/access_token': () => json({ access_token: 'access-2' })
    })

    const [first, second] = await Promise.all([
      sdk.fetch('/apps/'),
      sdk.fetch('/apps/')
    ])

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(requestsTo(fetchMock, '/auth/access_token')).toHaveLength(1)
    expect(sdk.status).toBe('ready')
  })

  it('logs out when the refresh fails', async () => {
    const { sdk } = await loggedIn({
      '/apps/': () => json({}, 401),
      '/auth/access_token': () => json({}, 400)
    })

    await expect(sdk.fetch('/apps/')).rejects.toThrow('access_token')
    expect(sdk.status).toBe('public')
  })

  it('fetchJSON rejects with the status of a failed request', async () => {
    const { sdk } = await loggedIn({ '/apps/': () => json({}, 500) })

    await expect(sdk.fetchJSON('/apps/')).rejects.toEqual(
      new SdkError('/apps/', 500)
    )
  })
})
