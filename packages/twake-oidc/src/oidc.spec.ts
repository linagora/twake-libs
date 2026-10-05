import * as client from 'openid-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { completeLogin, startLogin } from './oidc'
import { getAccessToken, clearTokenSet } from './session'
import { setUpBrowser } from './testUtils'

vi.mock('openid-client', () => ({
  discovery: vi.fn().mockResolvedValue({}),
  clockSkew: Symbol('clockSkew'),
  randomPKCECodeVerifier: vi.fn(() => 'verifier'),
  randomState: vi.fn(() => 'state'),
  calculatePKCECodeChallenge: vi.fn().mockResolvedValue('challenge'),
  buildAuthorizationUrl: vi.fn(() => new URL('https://sso.example.com/auth')),
  authorizationCodeGrant: vi.fn().mockResolvedValue({
    access_token: 'token',
    claims: (): { sub: string } => ({ sub: 'alice' })
  }),
  fetchUserInfo: vi.fn().mockResolvedValue({ sub: 'alice' })
}))

describe('sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearTokenSet()
  })

  it('goes to the SSO and comes back to the page it started from', async () => {
    const { assign } = setUpBrowser('https://app.example.com/contacts/42?q=a')
    await startLogin()
    expect(assign).toHaveBeenCalledWith(new URL('https://sso.example.com/auth'))

    window.location.href = 'https://app.example.com/callback?code=c&state=state'
    const result = await completeLogin()

    expect(client.authorizationCodeGrant).toHaveBeenCalledWith(
      {},
      new URL('https://app.example.com/callback?code=c&state=state'),
      { pkceCodeVerifier: 'verifier', expectedState: 'state' }
    )
    expect(result?.userinfo).toEqual({ sub: 'alice' })
    expect(result?.returnTo).toBe('/contacts/42?q=a')
    expect(getAccessToken()).toBe('token')
    expect(sessionStorage.getItem('redirectState')).toBeNull()
  })

  it('resolves to null when no sign-in is pending', async () => {
    setUpBrowser('https://app.example.com/callback')
    expect(await completeLogin()).toBeNull()
    expect(client.authorizationCodeGrant).not.toHaveBeenCalled()
  })

  it.each([
    ['//evil.com/phish', '/evil.com/phish'],
    ['///evil.com/phish', '/evil.com/phish'],
    // The URL parser turns a backslash in the path into a slash
    ['/\\evil.com/phish', '/evil.com/phish'],
    ['//evil.com/phish?q=a#top', '/evil.com/phish?q=a#top'],
    ['/%2F%2Fevil.com', '/%2F%2Fevil.com']
  ])('never comes back to another site from %s', async (path, returnTo) => {
    setUpBrowser(`https://app.example.com${path}`)
    await startLogin()

    window.location.href = 'https://app.example.com/callback?code=c&state=state'
    const result = await completeLogin()

    expect(result?.returnTo).toBe(returnTo)
    // Resolved against the application, it stays on the application
    expect(
      new URL(result?.returnTo ?? '', 'https://app.example.com').origin
    ).toBe('https://app.example.com')
  })

  it('does not come back to the redirect URI', async () => {
    setUpBrowser('https://app.example.com/callback?code=spent&state=old')
    await startLogin()

    expect((await completeLogin())?.returnTo).toBe('/')
  })
})
