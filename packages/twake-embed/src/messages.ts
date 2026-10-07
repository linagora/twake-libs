// The messages between TwakeSpace and a framed app, as `postMessage` data.
// Both sides check the origin and the source of what they receive, and parse
// it with the functions below: a message that does not fit is dropped.
import { isBelow } from './paths.js'

export const PATH_MESSAGE = 'twake-embed:path'
export const LOAD_MESSAGE = 'twake-embed:load'
export const NAVIGATE_MESSAGE = 'twake-embed:navigate'
export const LOGIN_REQUIRED_MESSAGE = 'twake-embed:login-required'
export const OVERLAY_REGION_MESSAGE = 'twake-embed:overlay-region'
export const FILL_PAGE_MESSAGE = 'twake-embed:fill-page'
export const HELLO_MESSAGE = 'twake-embed:hello'
export const READY_MESSAGE = 'twake-embed:ready'
export const BADGES_MESSAGE = 'twake-embed:badges'

/**
 * The URL of the frame changed. `replace` is true when the app replaced its
 * URL (a redirect, a query, the URL written while applying a `load` or a
 * `navigate`), false when the user moved: TwakeSpace then adds an entry.
 */
export interface PathMessage {
  type: typeof PATH_MESSAGE
  resourceId: string
  path: string
  replace: boolean
}

/**
 * The app is listening: TwakeSpace answers with its greeting. The app says
 * it to whoever framed it (an empty message, to any origin), since it does
 * not know its host yet; only a page its `frame-ancestors` allows can be
 * there.
 */
export interface ReadyMessage {
  type: typeof READY_MESSAGE
}

/** The silent login was refused: TwakeSpace signs the user in again */
export interface LoginRequiredMessage {
  type: typeof LOGIN_REQUIRED_MESSAGE
}

/** Where the app draws on its overlay: TwakeSpace shows that part only */
export interface OverlayRegionMessage {
  type: typeof OVERLAY_REGION_MESSAGE
  region: OverlayRegion
}

/**
 * The app needs the whole page of TwakeSpace, or gives it back: a call in
 * Chat. TwakeSpace lets the frame cover its page while `fill` is true, for
 * the apps it allows it to. Not the browser's full screen: that one an app
 * asks the browser for itself, with `requestFullscreen`.
 */
export interface FillPageMessage {
  type: typeof FILL_PAGE_MESSAGE
  fill: boolean
}

/** What the app counts for one of its resources: unread mail, notifications */
export interface Badge {
  resourceId: string
  count: number
}

/**
 * The counts of the app for every resource it knows, shown or not: one frame
 * of the app serves every space, so TwakeSpace keys them by resource, shows
 * them on the tab of each space and adds them up in its list of spaces. Each
 * message replaces the previous one; a count of 0, or a resource left out,
 * shows nothing.
 */
export interface BadgesMessage {
  type: typeof BADGES_MESSAGE
  badges: readonly Badge[]
}

/** Show another resource, at `path`, in the same frame */
export interface LoadMessage {
  type: typeof LOAD_MESSAGE
  resourceId: string
  path: string
}

/** Back, Forward or a deep link within the resource shown */
export interface NavigateMessage {
  type: typeof NAVIGATE_MESSAGE
  resourceId: string
  path: string
}

/**
 * TwakeSpace greets the frame on each of its loads: the app learns the
 * origin of its host from it, and answers from then on
 */
export interface HelloMessage {
  type: typeof HELLO_MESSAGE
}

/** From the app to TwakeSpace */
export type AppMessage =
  | ReadyMessage
  | PathMessage
  | LoginRequiredMessage
  | OverlayRegionMessage
  | FillPageMessage
  | BadgesMessage

/** From TwakeSpace to the app */
export type HostMessage = HelloMessage | LoadMessage | NavigateMessage

export interface OverlayBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The part of the overlay TwakeSpace shows: 'full' while something there
 * blocks the page (a dialog, a menu), otherwise the boxes the app draws, in
 * CSS px of the window
 */
export type OverlayRegion = 'full' | readonly OverlayBox[]

export function pathMessage(
  resourceId: string,
  path: string,
  replace: boolean
): PathMessage {
  return { type: PATH_MESSAGE, resourceId, path, replace }
}

export function readyMessage(): ReadyMessage {
  return { type: READY_MESSAGE }
}

export function loginRequiredMessage(): LoginRequiredMessage {
  return { type: LOGIN_REQUIRED_MESSAGE }
}

export function overlayRegionMessage(
  region: OverlayRegion
): OverlayRegionMessage {
  return { type: OVERLAY_REGION_MESSAGE, region }
}

export function fillPageMessage(fill: boolean): FillPageMessage {
  return { type: FILL_PAGE_MESSAGE, fill }
}

export function badgesMessage(badges: readonly Badge[]): BadgesMessage {
  return { type: BADGES_MESSAGE, badges }
}

export function loadMessage(resourceId: string, path: string): LoadMessage {
  return { type: LOAD_MESSAGE, resourceId, path }
}

export function navigateMessage(
  resourceId: string,
  path: string
): NavigateMessage {
  return { type: NAVIGATE_MESSAGE, resourceId, path }
}

export function helloMessage(): HelloMessage {
  return { type: HELLO_MESSAGE }
}

const MAX_BOXES = 32
const MAX_SIZE = 100_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCoordinate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAX_SIZE
  )
}

function toBox(value: unknown): OverlayBox | null {
  if (!isRecord(value)) return null
  const { x, y, width, height } = value
  if (
    !isCoordinate(x) ||
    !isCoordinate(y) ||
    !isCoordinate(width) ||
    !isCoordinate(height)
  ) {
    return null
  }
  if (width < 0 || height < 0) return null
  return { x, y, width, height }
}

/** A region as reported, bounded: at most 32 boxes of a sane size */
export function parseOverlayRegion(value: unknown): OverlayRegion | null {
  if (value === 'full') return 'full'
  if (!Array.isArray(value) || value.length > MAX_BOXES) return null
  const boxes: OverlayBox[] = []
  for (const item of value) {
    const box = toBox(item)
    if (box === null) return null
    boxes.push(box)
  }
  return boxes
}

const MAX_BADGES = 1_000
const MAX_COUNT = 1_000_000
const MAX_ID_LENGTH = 256

function toBadge(value: unknown): Badge | null {
  if (!isRecord(value)) return null
  const { resourceId, count } = value
  if (
    typeof resourceId !== 'string' ||
    resourceId === '' ||
    resourceId.length > MAX_ID_LENGTH
  ) {
    return null
  }
  if (typeof count !== 'number' || !Number.isInteger(count)) return null
  if (count < 0 || count > MAX_COUNT) return null
  return { resourceId, count }
}

/**
 * Counts as reported, bounded: at most 1000 resources, each with a whole
 * count from 0 to a million
 */
export function parseBadges(value: unknown): Badge[] | null {
  if (!Array.isArray(value) || value.length > MAX_BADGES) return null
  const badges: Badge[] = []
  for (const item of value) {
    const badge = toBadge(item)
    if (badge === null) return null
    badges.push(badge)
  }
  return badges
}

function isResourceAndPath(
  data: Record<string, unknown>
): data is Record<string, unknown> & { resourceId: string; path: string } {
  return (
    typeof data.resourceId === 'string' &&
    data.resourceId !== '' &&
    typeof data.path === 'string' &&
    isBelow(data.path)
  )
}

/** What an app sent, or null */
export function parseAppMessage(data: unknown): AppMessage | null {
  if (!isRecord(data)) return null
  switch (data.type) {
    case READY_MESSAGE:
      return readyMessage()
    case PATH_MESSAGE:
      return isResourceAndPath(data)
        ? pathMessage(data.resourceId, data.path, data.replace !== false)
        : null
    case LOGIN_REQUIRED_MESSAGE:
      return loginRequiredMessage()
    case OVERLAY_REGION_MESSAGE: {
      const region = parseOverlayRegion(data.region)
      return region === null ? null : overlayRegionMessage(region)
    }
    case FILL_PAGE_MESSAGE:
      return typeof data.fill === 'boolean' ? fillPageMessage(data.fill) : null
    case BADGES_MESSAGE: {
      const badges = parseBadges(data.badges)
      return badges === null ? null : badgesMessage(badges)
    }
    default:
      return null
  }
}

/** What TwakeSpace sent, or null */
export function parseHostMessage(data: unknown): HostMessage | null {
  if (!isRecord(data)) return null
  switch (data.type) {
    case HELLO_MESSAGE:
      return helloMessage()
    case LOAD_MESSAGE:
      return isResourceAndPath(data)
        ? loadMessage(data.resourceId, data.path)
        : null
    case NAVIGATE_MESSAGE:
      return isResourceAndPath(data)
        ? navigateMessage(data.resourceId, data.path)
        : null
    default:
      return null
  }
}
