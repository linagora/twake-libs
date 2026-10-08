# twake-bar

The top bar of the Twake platform for Twake React applications: home button, app title, help link, applications menu and user menu. It reads the platform through `@linagora/twake-sdk` and renders with `@linagora/twake-mui`.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-bar @linagora/twake-sdk
```

`@linagora/twake-mui`, `@linagora/twake-icons`, `twake-i18n`, `react` and `react-dom` are peer dependencies.

## Usage

The host owns the SSO and the theme. It creates the SDK with the user's id token and renders the bar under its providers:

```tsx
import { SdkProvider, TwakeBar, TWAKE_BAR_HEIGHT } from '@linagora/twake-bar'
import { createSdk } from '@linagora/twake-sdk'

const sdk = createSdk({
  platformURL: `https://${userinfo.workplaceFqdn}`,
  idToken: tokenSet.id_token
})

<TwakeMuiThemeProvider mode={mode}>
  <I18n lang={lang} dictRequire={dictRequire}>
    <SdkProvider client={sdk}>
      <TwakeBar
        app={{ slug: 'calendar', name: 'Calendar', icon: '/icon.svg', textIcon: '/text.svg' }}
        onLogOut={logOut}
      />
      {/* reserve TWAKE_BAR_HEIGHT above the content */}
    </SdkProvider>
  </I18n>
</TwakeMuiThemeProvider>
```

The bar follows the SDK status: logged out when it is `public`, an avatar skeleton while it is `waiting`, the menus once it is `ready`. Locale and theme come from the host's `I18n` and `TwakeMuiThemeProvider`.

### Props

- `app`: `slug`, `name`, `icon` URL and optional `textIcon` URL, served by the host. The text icon renders at its intrinsic size, top aligned on the 22px Twake wordmark, so size it against that box and let descenders extend below
- `onLogOut`: called by the log out item, the host ends its SSO session
- `slots`: `left` replaces the home button and title, `center`, `search` fills the middle, `right` is rendered before the menus
- `showEmailDomainChip`: warns when the organization has no mail app yet (default `true`)

### Hooks

`useSdk()`, `useSdkStatus()` and `useSdkData(load)` are exported for host components that need the same platform data.
