import { vi } from 'vitest'

import { configureAuth } from './oidc'

/** Browser globals the library reads, for tests running in node */
export function setUpBrowser(href: string): {
  assign: ReturnType<typeof vi.fn>
} {
  const assign = vi.fn()
  const url = new URL(href)
  const storage = new Map<string, string>()
  vi.stubGlobal('window', {
    location: {
      href,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      assign
    }
  })
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key)
  })
  configureAuth({
    ssoUrl: 'https://sso.example.com',
    clientId: 'app',
    scope: 'openid email',
    redirectUri: 'https://app.example.com/callback',
    postLogoutRedirectUri: 'https://app.example.com',
    apiUrl: 'https://api.example.com'
  })
  return { assign }
}
