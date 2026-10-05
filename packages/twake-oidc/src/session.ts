import type {
  TokenEndpointResponse,
  TokenEndpointResponseHelpers
} from 'openid-client'

export type TokenSet = TokenEndpointResponse & TokenEndpointResponseHelpers

const CHANNEL_NAME = 'twake-oidc-session'
const SESSION_ENDED = 'session-ended'

/**
 * The tokens of the session, held in memory only: web storage is readable by
 * any script of the page, so a single XSS would hand them over for replay
 * from anywhere. A reload goes through the SSO again, which signs the user
 * back in silently while their SSO session lasts.
 */
let tokenSet: Partial<TokenSet> | null = null

export function setTokenSet(tokens: Partial<TokenSet>): void {
  tokenSet = tokens
}

export function getAccessToken(): string | undefined {
  return tokenSet?.access_token
}

export function clearTokenSet(): void {
  tokenSet = null
}

/**
 * Ends the session in this browser: drops the tokens this tab holds in memory
 * and tells the other tabs of the application to drop theirs. The SSO
 * session, and the tokens already issued, are ended by the SSO itself
 * (back-channel logout).
 */
export function endLocalSession(): void {
  clearTokenSet()
  const channel = new BroadcastChannel(CHANNEL_NAME)
  channel.postMessage(SESSION_ENDED)
  channel.close()
}

/**
 * Calls onEnded when another tab of the application ends the session, after
 * dropping the tokens this tab holds.
 *
 * @returns a function that stops listening.
 */
export function onSessionEndedElsewhere(onEnded: () => void): () => void {
  const channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = (event: MessageEvent): void => {
    if (event.data === SESSION_ENDED) {
      clearTokenSet()
      onEnded()
    }
  }
  return () => channel.close()
}
