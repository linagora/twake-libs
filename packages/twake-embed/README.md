# twake-embed

The contract between TwakeSpace and the apps it frames in the tabs of a space
(ADR 010 of twake-space-architecture): the browser history, the messages, and
the overlay the app draws its dialogs and windows on.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-embed
```

## The rule

The page and its frames share one browser history, and TwakeSpace owns it. In
a frame the app never adds an entry and never navigates its own document after
its boot: `pushState` becomes `replaceState`, every change of the frame's URL
is reported to TwakeSpace, and TwakeSpace moves the frame with `load` (another
resource) and `navigate` (Back, Forward, a deep link).

Measured in Chromium, Firefox and WebKit: a removed frame keeps its history
entries as dead Back presses in Chromium and WebKit, a frame that only
replaces adds none, and Chromium reloads a frame to the document it had when
the page goes back to an entry recorded before the frame navigated.

## In the app

Connect as soon as the app knows it is framed, even on the callback page of
its silent login, and sync the history once its router exists:

```ts
import { connectToTwakeSpace, embedRoute } from '@linagora/twake-embed'

const space = connectToTwakeSpace({
  hostOrigins: window.TWAKE_SPACE_ORIGIN.split(' '),
  embedPrefix: '/embed/projects/'
})
// null when not framed or without a host origin

const stop = space?.syncHistory({
  // Show another resource at `path`, in place; or, until the app can,
  // location.replace(embedRoute('/embed/projects/', resourceId) + path)
  onLoad: (resourceId, path) =>
    router.navigate(embedRoute('/embed/projects/', resourceId) + path, {
      replace: true
    }),
  // Show `path` within the resource shown
  onNavigate: (resourceId, path) =>
    router.navigate(embedRoute('/embed/projects/', resourceId) + path, {
      replace: true
    })
})
```

`path` is '' on the embed route itself, otherwise the rest of the URL below
it, starting with `/`, `?` or `#`; a `//` or a `\\` in its pathname is refused. Nothing a handler writes to the URL is
reported while its promise is pending. Pass `isResourceId` to refuse ids that
do not look like the app's.

The silent login (`prompt=none`) runs at boot with `location.replace`;
renewals use a refresh token or a nested frame. When the login is refused:

```ts
space?.notifyLoginRequired()
```

An app TwakeSpace allows to (Chat, for its calls) can take the whole page
and give it back:

```ts
space?.requestFullPage(true)
```

The overlay: TwakeSpace frames `<app url>/embed/overlay.html`, an empty page
of the app's origin, next to the app's frame and named after it. The app
renders its dialogs and docked windows into it, and reports where it draws:

```ts
import { connectSpaceOverlay } from '@linagora/twake-embed'

const overlay = connectSpaceOverlay(region => space?.reportOverlayRegion(region))
// overlay.getBody() is the element to portal into once overlay.getStatus() is 'connected'
```

## In TwakeSpace

```ts
import { parseAppMessage, loadMessage, navigateMessage, embedUrl } from '@linagora/twake-embed'
```

`parseAppMessage` reads what a frame sends, once the origin and the source
window are checked. `embedUrl` builds the frame's `src` for a resource at a
path, and refuses a path that leaves the embed route.
