import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSdk, SdkError, type Sdk } from './sdk'
import {
  CREDENTIALS,
  PLATFORM_URL,
  authorizationOf,
  bodyOf,
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

const flags = (values: Record<string, unknown>): Response =>
  json({ data: { id: 'flags', type: 'io.cozy.settings', attributes: values } })

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

describe('platform data', () => {
  it('lists the apps without the hidden ones, once', async () => {
    const { sdk, fetchMock } = await loggedIn({
      '/apps/': () => json(APPS),
      '/settings/flags': () => flags({ 'apps.hidden': ['hidden'] })
    })

    const apps = await sdk.getApps()
    await sdk.getApps()

    expect(apps.map(app => app.slug)).toEqual(['home', 'calendar'])
    expect(apps[0]).toMatchObject({
      id: 'io.cozy.apps/home',
      name: 'Home',
      links: { related: 'https://alice-home.twake.example/' }
    })
    expect(requestsTo(fetchMock, '/apps/')).toHaveLength(1)
  })

  it('merges the instance with its disk usage as numbers', async () => {
    const { sdk } = await loggedIn({
      '/settings/instance': () =>
        json({
          data: {
            id: 'io.cozy.settings.instance',
            type: 'io.cozy.settings',
            attributes: { email: 'alice@example.com', public_name: 'Alice' }
          }
        }),
      '/settings/disk-usage': () =>
        json({
          data: {
            id: 'io.cozy.settings.disk-usage',
            type: 'io.cozy.settings',
            attributes: { used: '1024', quota: '2048' }
          }
        })
    })

    await expect(sdk.getInstance()).resolves.toEqual({
      email: 'alice@example.com',
      public_name: 'Alice',
      diskUsage: 1024,
      diskQuota: 2048
    })
  })

  it('reads the context of the instance', async () => {
    const { sdk } = await loggedIn({
      '/settings/context': () =>
        json({
          data: {
            id: 'io.cozy.settings.context',
            type: 'io.cozy.settings',
            attributes: { help_link: 'https://help.example' }
          }
        })
    })

    await expect(sdk.getContext()).resolves.toEqual({
      help_link: 'https://help.example'
    })
  })

  it('resolves the shortcuts of the Home folder, none without the folder', async () => {
    const { sdk } = await loggedIn({
      '/files/metadata': () =>
        json({
          data: { id: 'home-dir', type: 'io.cozy.files', attributes: {} },
          included: [
            {
              id: 'shortcut-1',
              type: 'io.cozy.files',
              attributes: {
                name: 'Docs.url',
                class: 'shortcut',
                metadata: { icon: 'aWNvbg==', iconMimeType: 'image/png' }
              }
            },
            {
              id: 'note-1',
              type: 'io.cozy.files',
              attributes: { name: 'Note.md', class: 'text' }
            }
          ]
        }),
      '/shortcuts/shortcut-1': () =>
        json({
          data: {
            id: 'shortcut-1',
            type: 'io.cozy.files.shortcuts',
            attributes: { name: 'Docs.url', url: 'https://docs.example' }
          }
        })
    })

    await expect(sdk.getShortcuts()).resolves.toEqual([
      {
        id: 'shortcut-1',
        name: 'Docs.url',
        url: 'https://docs.example',
        icon: 'data:image/png;base64,aWNvbg=='
      }
    ])

    const { sdk: withoutHome } = await loggedIn({})
    await expect(withoutHome.getShortcuts()).resolves.toEqual([])
  })

  it('creates an intent and returns its services', async () => {
    const { sdk, fetchMock } = await loggedIn({
      '/intents': () =>
        json({
          data: {
            id: 'intent-1',
            type: 'io.cozy.intents',
            attributes: {
              action: 'PICK',
              type: 'io.cozy.files',
              services: [{ slug: 'drive', href: 'https://drive/pick' }]
            }
          }
        })
    })

    const intent = await sdk.createIntent({
      action: 'PICK',
      type: 'io.cozy.files'
    })

    expect(intent).toMatchObject({
      id: 'intent-1',
      services: [{ slug: 'drive', href: 'https://drive/pick' }]
    })
    const [init] = requestsTo(fetchMock, '/intents')
    expect(bodyOf(init)).toEqual({
      data: {
        type: 'io.cozy.intents',
        attributes: { action: 'PICK', type: 'io.cozy.files' }
      }
    })
  })
})

describe('getAppURL', () => {
  it('opens a standalone app at its client URL when the flag allows it', async () => {
    const { sdk } = await loggedIn({
      '/apps/': () => json(APPS),
      '/settings/flags': () =>
        flags({
          'apps.enable-standalone-apps': true,
          'calendar.client-url': 'https://calendar.twake.example'
        })
    })

    await expect(sdk.getAppURL('calendar', '/#/settings')).resolves.toBe(
      'https://calendar.twake.example/#/settings'
    )
    await expect(sdk.getAppURL('home')).resolves.toBe(
      'https://alice-home.twake.example/'
    )
  })

  it('keeps the platform URL when standalone apps are disabled or the flag is not a URL', async () => {
    const { sdk } = await loggedIn({
      '/apps/': () => json(APPS),
      '/settings/flags': () => flags({ 'calendar.client-url': 'not a url' })
    })

    await expect(sdk.getAppURL('calendar')).resolves.toBe(
      'https://alice-calendar.twake.example/'
    )
    await expect(sdk.getAppURL('missing')).resolves.toBeNull()
  })

  it('resolves the URL of a hidden app', async () => {
    const { sdk } = await loggedIn({
      '/apps/': () =>
        json({
          data: [
            {
              ...APPS.data[2],
              links: { related: 'https://alice-hidden.twake.example/' }
            }
          ]
        }),
      '/settings/flags': () => flags({ 'apps.hidden': ['hidden'] })
    })

    await expect(sdk.getApps()).resolves.toEqual([])
    await expect(sdk.getAppURL('hidden')).resolves.toBe(
      'https://alice-hidden.twake.example/'
    )
  })
})
