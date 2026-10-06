# twake-sdk

Platform client for Twake applications: exchanges the SSO id token for a cozy-stack token, refreshes it, and gives access to the platform data (apps, instance, flags, shortcuts, intents).

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-sdk
```

## Usage

The host owns the SSO (for example with `@linagora/twake-oidc`) and hands the id token to the SDK:

```ts
import { createSdk } from '@linagora/twake-sdk'

const sdk = createSdk({
  platformURL: `https://${userinfo.workplaceFqdn}`,
  idToken: tokenSet.id_token
})

sdk.status // 'waiting' while the token is exchanged, then 'ready'
sdk.onStatusChange(status => render(status))

await sdk.login(renewedIdToken) // when the host renews its id token
sdk.logout() // forgets the tokens, the SSO end_session revokes the OAuth client
```

Requests go to the platform with the bearer token. A 401 refreshes the token once and retries:

```ts
const response = await sdk.fetch('/files/io.cozy.files.root-dir')
const root = await sdk.fetchJSON<RootDir>('/files/io.cozy.files.root-dir')
```

Tokens stay in memory: a reload exchanges the id token again.

## Platform requirements

`token_exchange` succeeds when the host requests the `workplaceFqdn` scope, the stack context lists the host's SSO client in `oidc.app_token_exchange`, and the host's container app is installed from the registry.
