# twake-react-new-version

Tells the user of a Twake application that the server now serves a newer build than the one running in the tab, and offers to reload the page.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-react-new-version
```

`@linagora/twake-mui`, `twake-i18n`, `react` and `react-dom` are peer dependencies.

## What the app serves

Each build has its own id (the commit in CI, for instance). The app:

- writes it in the bundle, so the running tab knows its own build;
- serves it at `/version.json` as `{ "build": "<id>" }`, with `Cache-Control: no-store`.

The id must be in the bundle, not read at runtime from a file served next to it: during a rollout a tab may get the bundle of the old server and that file from the new one, and would never be offered a reload.

## Usage

Mount the dialog once, under the app's `I18n` and `TwakeMuiThemeProvider`:

```tsx
import { NewVersionDialog } from '@linagora/twake-react-new-version'

const AppVersion = (): React.ReactElement => (
  <NewVersionDialog running={BUILD_ID} appName="Twake Mail" />
)
```

When a lazy chunk fails to load, the usual sign of a tab older than the served build, ask for a check at once:

```ts
import { requestVersionCheck } from '@linagora/twake-react-new-version'

const ComposerForm = lazy(() =>
  import('./ComposerForm').catch((error: unknown) => {
    requestVersionCheck()
    throw error
  })
)
```

### When it checks

Every 10 minutes, when the tab gets the focus, becomes visible again or comes back online, and on `requestVersionCheck()`. One check at a time, and at most one every 30 seconds but the ones `requestVersionCheck()` asks for: a framed app gets the focus at each click of its host. Never at mount: the page just loaded is the served build. An error, the network, or an answer that is not that JSON (a dev server answers `index.html`) is no new build.

### What the user sees

« New version available », with « Not now » and « Reload ». « Not now », Escape or a click outside decline that build for the life of the tab: the dialog comes back only for a build not declined yet, so a rollback to a declined build is not offered again.

### Props

- `running`: the build id of this bundle
- `appName`: the name shown in the text, such as `Twake Mail`
- `fetchServed()`: reads the served build id, `fetchServedBuild` by default
- `reload()`: `window.location.reload` by default
- `intervalMs`: time between two checks, 10 minutes by default

### Texts

`en`, `fr`, `de`, `es`, `it`, `ru` and `vi`, added to the app's `I18n` under `twakeNewVersion`; English for any other language.

### Detection alone

`fetchServedBuild(url = '/version.json')` and `isNewBuild(running, served)` are exported for an app that wants another surface than the dialog.
