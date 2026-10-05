# twake-oidc

SSO sign-in (OIDC authorization code + PKCE) and session handling for Twake applications.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-oidc
```

## Usage

Configure once, before the application renders:

```ts
import { configureAuth } from '@linagora/twake-oidc'

configureAuth({
  ssoUrl: window.SSO_BASE_URL,
  clientId: window.SSO_CLIENT_ID,
  scope: window.SSO_SCOPE,
  redirectUri: window.SSO_REDIRECT_URI,
  postLogoutRedirectUri: window.SSO_POST_LOGOUT_REDIRECT,
  apiUrl: window.MY_BACKEND_URL
})
```

Twake apps make their HTTP calls with [ky](https://github.com/sindresorhus/ky). Its hooks hand the token to the backend, and sign in again when it answers 401 (ky then rejects the request with an `HTTPError`):

```ts
import ky from 'ky'
import { addAuthorization, redirectOnUnauthorized } from '@linagora/twake-oidc'

export const api = ky.create({
  prefixUrl: window.MY_BACKEND_URL,
  hooks: {
    beforeRequest: [addAuthorization],
    afterResponse: [redirectOnUnauthorized]
  }
})
```

Sign in:

- `startLogin()` sends the user to the SSO.
- `completeLogin()`, on the redirect URI page, exchanges the code for the tokens and resolves to `{ tokenSet, userinfo, returnTo }`, or `null` when no sign-in is pending. `returnTo` is the path the user was on when the sign-in started.
- `getAccessToken()` tells whether this tab holds a session.

Sign out:

- `logOut()` drops the tokens here and in the other tabs, then goes to the SSO logout.
- `onSessionEndedElsewhere(callback)` calls back when another tab signs out.

The tokens are kept in memory only, never in web storage: a reload signs in again through the SSO, silently while the SSO session lasts.
