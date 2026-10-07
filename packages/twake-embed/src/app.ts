// The app side of the contract: what an app framed by TwakeSpace does.
//
// The page and its frames share one browser history, and TwakeSpace owns it:
// in a frame the app never adds an entry and never navigates its own
// document after its boot. `syncHistory` turns `pushState` into
// `replaceState`, reports every change of the frame's URL, and applies the
// `load` and `navigate` messages of TwakeSpace. Measured in Chromium, Firefox
// and WebKit: a removed frame keeps its entries as dead Back presses in
// Chromium and WebKit, and a frame that only replaces adds none.
import {
  loginRequiredMessage,
  overlayRegionMessage,
  parseHostMessage,
  pathMessage,
  type AppMessage,
  type OverlayRegion
} from './messages.js'
import {
  embedRoute,
  parseEmbedUrl,
  staysBelow,
  type EmbedLocation
} from './paths.js'

export interface TwakeSpaceOptions {
  /** The origins of TwakeSpace the app accepts, and posts to */
  hostOrigins: readonly string[]
  /** The embed route without the resource id, '/embed/projects/' */
  embedPrefix: string
  /** The shape of a resource id of this app, when it has one */
  isResourceId?: (resourceId: string) => boolean
  /** The frame's parent, for tests */
  parent?: Window
}

export interface HistoryHandlers {
  /**
   * Show another resource at `path`, with a replace: the app resets what is
   * keyed by the resource. An app that cannot yet does
   * `location.replace(embedRoute(prefix, resourceId) + path)`. Nothing the
   * handler writes to the URL is reported while its promise is pending.
   */
  onLoad: (resourceId: string, path: string) => void | Promise<void>
  /** Show `path` within the resource shown, with a replace */
  onNavigate: (resourceId: string, path: string) => void | Promise<void>
}

export interface TwakeSpaceConnection {
  /** The resource and path of the frame's URL, null off the embed route */
  location: () => EmbedLocation | null
  /** The silent login was refused: TwakeSpace signs the user in again */
  notifyLoginRequired: () => void
  /** Where the app draws on its overlay, see `connectSpaceOverlay` */
  reportOverlayRegion: (region: OverlayRegion) => void
  /**
   * Leaves the history to TwakeSpace, from now on: a push becomes a replace,
   * every change of the URL is reported (the current one first, as a
   * replace), and `load` and `navigate` are applied through the handlers.
   * Once: a second call returns the same stop function.
   */
  syncHistory: (handlers: HistoryHandlers) => () => void
  /** Stops the history sync */
  disconnect: () => void
}

/**
 * The connection to TwakeSpace, null when the app is not framed or has no
 * host origin: the app then runs on its own. Off the embed route (the
 * callback of the silent login, where a framed app may boot) the connection
 * holds: nothing is reported until the URL is back on the route.
 */
export function connectToTwakeSpace(
  options: TwakeSpaceOptions
): TwakeSpaceConnection | null {
  const {
    hostOrigins,
    embedPrefix,
    isResourceId = (): boolean => true
  } = options
  const parent = options.parent ?? window.parent
  if (parent === window || hostOrigins.length === 0) return null

  const location = (): EmbedLocation | null => {
    const { pathname, search, hash } = window.location
    return parseEmbedUrl(embedPrefix, pathname, search, hash)
  }

  const post = (message: AppMessage): void => {
    for (const origin of hostOrigins) parent.postMessage(message, origin)
  }

  let stop: (() => void) | null = null
  let suppressed = 0
  const reportCurrent = (replace: boolean): void => {
    if (suppressed > 0) return
    const here = location()
    if (here !== null) post(pathMessage(here.resourceId, here.path, replace))
  }
  // Nothing written while a handler runs is reported: TwakeSpace asked for
  // it. A router writes the URL once its navigation settles, hence the await.
  const apply = async (handler: () => void | Promise<void>): Promise<void> => {
    suppressed += 1
    try {
      await handler()
    } finally {
      suppressed -= 1
    }
  }

  const syncHistory = (handlers: HistoryHandlers): (() => void) => {
    if (stop !== null) return stop
    const { history } = window
    // Called back on `history`, restored as they were
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { pushState, replaceState } = history
    const owned = {
      pushState: Object.hasOwn(history, 'pushState'),
      replaceState: Object.hasOwn(history, 'replaceState')
    }
    history.pushState = function (...args): void {
      replaceState.apply(history, args)
      reportCurrent(false)
    }
    history.replaceState = function (...args): void {
      replaceState.apply(history, args)
      reportCurrent(true)
    }

    const onMessage = (event: MessageEvent<unknown>): void => {
      if (!hostOrigins.includes(event.origin) || event.source !== parent) return
      const message = parseHostMessage(event.data)
      if (message === null || message.type === 'twake-space:theme') return
      const { resourceId, path } = message
      if (!isResourceId(resourceId)) return
      if (!staysBelow(embedRoute(embedPrefix, resourceId), path)) return
      if (message.type === 'twake-embed:navigate') {
        if (location()?.resourceId !== resourceId) return
        void apply(() => handlers.onNavigate(resourceId, path))
      } else {
        void apply(() => handlers.onLoad(resourceId, path))
      }
    }
    window.addEventListener('message', onMessage)

    // The first URL came from no history call
    reportCurrent(true)

    stop = (): void => {
      window.removeEventListener('message', onMessage)
      // Own properties shadow the ones of History: dropping them restores it
      if (owned.pushState) history.pushState = pushState
      else Reflect.deleteProperty(history, 'pushState')
      if (owned.replaceState) history.replaceState = replaceState
      else Reflect.deleteProperty(history, 'replaceState')
      stop = null
    }
    return stop
  }

  return {
    location,
    notifyLoginRequired: (): void => {
      post(loginRequiredMessage())
    },
    reportOverlayRegion: (region): void => {
      post(overlayRegionMessage(region))
    },
    syncHistory,
    disconnect: (): void => {
      stop?.()
    }
  }
}
