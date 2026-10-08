import * as client from 'openid-client'

import { endLocalSession, setTokenSet, type TokenSet } from './session'

export interface AuthConfig {
  /** Issuer URL of the SSO, where its OIDC discovery document lives */
  ssoUrl: string
  clientId: string
  scope: string
  /** Page of the application the SSO sends the user back to */
  redirectUri: string
  postLogoutRedirectUri: string
  /** Backend of the application: the only one that gets the access token */
  apiUrl: string
}

export interface LoginResult {
  tokenSet: TokenSet
  userinfo: client.UserInfoResponse
  /** Path of the application the user was on when the sign-in started */
  returnTo: string
}

interface RedirectState {
  code_verifier: string
  state: string
  returnTo: string
}

const DISCOVERY_TIMEOUT_S = 10
const REDIRECT_STATE_KEY = 'redirectState'

let authConfig: AuthConfig | null = null

export function configureAuth(config: AuthConfig): void {
  authConfig = config
}

export function getAuthConfig(): AuthConfig {
  if (!authConfig) {
    throw new Error('twake-oidc is not configured: call configureAuth first')
  }
  return authConfig
}

export const isOnRedirectUri = (): boolean =>
  window.location.pathname ===
  new URL(getAuthConfig().redirectUri, window.location.href).pathname

async function discover(): Promise<client.Configuration> {
  const { ssoUrl, clientId } = getAuthConfig()
  return await client.discovery(
    new URL(ssoUrl),
    clientId,
    // Tolerate up to 5 minutes of clock skew between browser and SSO server
    { [client.clockSkew]: 300 },
    undefined,
    { timeout: DISCOVERY_TIMEOUT_S }
  )
}

function readRedirectState(): RedirectState | null {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(REDIRECT_STATE_KEY) ?? 'null'
    ) as Partial<RedirectState> | null
    if (saved?.code_verifier && saved.state) {
      return { returnTo: '/', ...saved } as RedirectState
    }
  } catch {
    // An unreadable state is no pending sign-in
  }
  return null
}

/**
 * Sends the user to the SSO, which sends them back to the redirect URI where
 * completeLogin finishes the sign-in.
 */
export async function startLogin(): Promise<void> {
  const { redirectUri, scope } = getAuthConfig()
  const code_verifier = client.randomPKCECodeVerifier()
  const state = client.randomState()
  const authorizationUrl = client.buildAuthorizationUrl(await discover(), {
    redirect_uri: redirectUri,
    scope,
    code_challenge: await client.calculatePKCECodeChallenge(code_verifier),
    code_challenge_method: 'S256',
    state
  })
  const { pathname, search, hash } = window.location
  const redirectState: RedirectState = {
    code_verifier,
    state,
    // The redirect URI holds a spent code: coming back there would start over.
    // A path starting with // would be a protocol-relative URL to another site.
    returnTo: isOnRedirectUri()
      ? '/'
      : pathname.replace(/^\/+/, '/') + search + hash
  }
  sessionStorage.setItem(REDIRECT_STATE_KEY, JSON.stringify(redirectState))
  window.location.assign(authorizationUrl)
}

/**
 * Finishes, on the redirect URI, the sign-in started by startLogin: the
 * tokens are kept for the API requests before this resolves.
 *
 * @returns null when no sign-in is pending, e.g. the page was reloaded.
 */
export async function completeLogin(): Promise<LoginResult | null> {
  const saved = readRedirectState()
  sessionStorage.removeItem(REDIRECT_STATE_KEY)
  if (!saved) return null

  const configuration = await discover()
  const tokenSet = await client.authorizationCodeGrant(
    configuration,
    new URL(window.location.href),
    { pkceCodeVerifier: saved.code_verifier, expectedState: saved.state }
  )
  const sub = tokenSet.claims()?.sub
  if (!sub) throw new Error('The SSO returned no ID token')

  const userinfo = await client.fetchUserInfo(
    configuration,
    tokenSet.access_token,
    sub
  )
  setTokenSet(tokenSet)
  return { tokenSet, userinfo, returnTo: saved.returnTo }
}

/**
 * Ends the session here and on the SSO, then leaves the application.
 */
export async function logOut(): Promise<void> {
  try {
    const configuration = await discover()
    const endSessionUrl = client.buildEndSessionUrl(configuration, {
      post_logout_redirect_uri: getAuthConfig().postLogoutRedirectUri
    })

    endLocalSession()

    window.location.assign(endSessionUrl)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Logout failed:', error)

    endLocalSession()
    window.location.assign('/')
  }
}
