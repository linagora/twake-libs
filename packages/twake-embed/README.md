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
its silent login, and sync the history once its router exists. The app does
not need TwakeSpace's address: TwakeSpace greets the frame
(`twake-embed:hello`) on each of its loads and whenever the app says it is
listening (`twake-embed:ready`, posted to whoever framed it, since the app
may boot after the frame's load), and the app answers the origin that
greeted it. Only a page the app's `frame-ancestors` allows can be that
parent, so that header stays mandatory, and it is where the address of
TwakeSpace belongs, in the deployment of the app. `hostOrigins` restricts the
hosts further when an app wants to.

```ts
import { connectToTwakeSpace, embedRoute } from '@linagora/twake-embed'

const space = connectToTwakeSpace({ embedPrefix: '/embed/projects/' })
// null when not framed

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

Two ways to grow, not to be confused:

- **The page of TwakeSpace.** An app TwakeSpace allows to (Chat, for its
  calls) can take the whole page of TwakeSpace and give it back. TwakeSpace
  makes the frame cover its page and the rest of it inert:

  ```ts
  space?.fillPage(true)
  ```

- **The browser's full screen.** The app asks the browser itself, from a user
  gesture, for one of its elements or its whole document, as a video player
  does. It works in a frame only if TwakeSpace granted it with
  `allow="fullscreen"` on the frame:

  ```ts
  import { canGoFullscreen, requestFullscreen, exitFullscreen } from '@linagora/twake-embed'

  if (canGoFullscreen()) await requestFullscreen(player)
  ```

The overlay: TwakeSpace frames `<app url>/embed/overlay.html`, an empty page
of the app's origin, next to the app's frame and named after it. The app
renders its dialogs and docked windows into it with `@linagora/twake-mui`
(`SpaceOverlayProvider`, `connectSpaceOverlay`), and reports where it draws:

```ts
space?.reportOverlayRegion(region)
```

The badges: a count TwakeSpace shows on the app's tab (unread mail, unread
notifications), and adds up per space in its list of spaces. One frame of the
app serves every space, so the app reports the counts of every resource it
knows, the one shown or not, keyed by the resource id of its embed route.
Each call replaces the previous counts; 0, or a resource left out, shows
nothing. Report again whenever a count changes:

```ts
space?.reportBadges([
  { resourceId: 'mbx-1', count: 3 },
  { resourceId: 'mbx-2', count: 0 }
])
```

## In TwakeSpace

```ts
import { helloMessage, parseAppMessage, loadMessage, navigateMessage, embedUrl } from '@linagora/twake-embed'
```

TwakeSpace posts `helloMessage()` to a frame on each of its `load` events
and in answer to its `twake-embed:ready`, with the app's origin as target. `parseAppMessage` reads what a frame sends,
once the origin and the source window are checked; a `twake-embed:badges`
message holds the app's counts by resource id. `embedUrl` builds the frame's `src` for a resource at a
path, and refuses a path that leaves the embed route.
