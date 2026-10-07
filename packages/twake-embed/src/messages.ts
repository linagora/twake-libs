// The messages between TwakeSpace and a framed app, as `postMessage` data.
// Both sides check the origin and the source of what they receive, and parse
// it with the functions below: a message that does not fit is dropped.
import { isBelow } from './paths.js'

export const PATH_MESSAGE = 'twake-embed:path'
export const LOAD_MESSAGE = 'twake-embed:load'
export const NAVIGATE_MESSAGE = 'twake-embed:navigate'
export const LOGIN_REQUIRED_MESSAGE = 'twake-embed:login-required'
export const OVERLAY_REGION_MESSAGE = 'twake-embed:overlay-region'
export const THEME_MESSAGE = 'twake-space:theme'

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

/** The silent login was refused: TwakeSpace signs the user in again */
export interface LoginRequiredMessage {
  type: typeof LOGIN_REQUIRED_MESSAGE
}

/** Where the app draws on its overlay: TwakeSpace shows that part only */
export interface OverlayRegionMessage {
  type: typeof OVERLAY_REGION_MESSAGE
  region: OverlayRegion
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

/** The colour scheme of TwakeSpace's page */
export interface ThemeMessage {
  type: typeof THEME_MESSAGE
  theme: 'light' | 'dark'
}

/** From the app to TwakeSpace */
export type AppMessage =
  | PathMessage
  | LoginRequiredMessage
  | OverlayRegionMessage

/** From TwakeSpace to the app */
export type HostMessage = LoadMessage | NavigateMessage | ThemeMessage

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

export function loginRequiredMessage(): LoginRequiredMessage {
  return { type: LOGIN_REQUIRED_MESSAGE }
}

export function overlayRegionMessage(
  region: OverlayRegion
): OverlayRegionMessage {
  return { type: OVERLAY_REGION_MESSAGE, region }
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

export function themeMessage(theme: 'light' | 'dark'): ThemeMessage {
  return { type: THEME_MESSAGE, theme }
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
    default:
      return null
  }
}

/** What TwakeSpace sent, or null */
export function parseHostMessage(data: unknown): HostMessage | null {
  if (!isRecord(data)) return null
  switch (data.type) {
    case LOAD_MESSAGE:
      return isResourceAndPath(data)
        ? loadMessage(data.resourceId, data.path)
        : null
    case NAVIGATE_MESSAGE:
      return isResourceAndPath(data)
        ? navigateMessage(data.resourceId, data.path)
        : null
    case THEME_MESSAGE:
      return data.theme === 'light' || data.theme === 'dark'
        ? themeMessage(data.theme)
        : null
    default:
      return null
  }
}
