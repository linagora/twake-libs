/** What the SDK is showing to the host: no user, user logging in, user known */
export type SdkStatus = 'public' | 'waiting' | 'ready'

export interface SdkOptions {
  /** URL of the user's platform: `https://${workplaceFqdn}` */
  platformURL: string
  /** OIDC id token of the user, when the host is already signed in */
  idToken?: string
  /** Milliseconds before a client left `waiting` falls back to `public` */
  waitingTimeout?: number
}

/** Tokens returned by `POST /auth/token_exchange` */
export interface Credentials {
  accessToken: string
  refreshToken: string
  clientId: string
  clientSecret: string
}
