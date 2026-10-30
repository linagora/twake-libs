export type FeedbackSide = 'left' | 'right'

export interface FeedbackPosition {
  side: FeedbackSide
  /** Distance in px between the bottom of the viewport and the button */
  bottom: number
}

/** Height of a default MUI Fab, above the 48 px of the extended one */
export const FAB_SIZE = 56
/** Gap in px kept between the button and the edges of the viewport */
export const EDGE_MARGIN = 16
/** Movement in px after which a press becomes a drag */
export const DRAG_THRESHOLD = 5

export const STORAGE_PREFIX = 'twake-feedback:'

export const getDefaultPosition = (bottomOffset: number): FeedbackPosition => ({
  side: 'right',
  bottom: EDGE_MARGIN + bottomOffset
})

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, Math.max(min, max)))

/** Keeps the button in the viewport and above `bottomOffset` */
export const clampBottom = (
  bottom: number,
  viewportHeight: number,
  bottomOffset: number
): number =>
  clamp(
    bottom,
    EDGE_MARGIN + bottomOffset,
    viewportHeight - FAB_SIZE - EDGE_MARGIN
  )

export const readPosition = (storageKey: string): FeedbackPosition | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { side, bottom } = value as Record<string, unknown>
    if (
      (side !== 'left' && side !== 'right') ||
      typeof bottom !== 'number' ||
      !Number.isFinite(bottom)
    ) {
      return null
    }
    return { side, bottom }
  } catch {
    return null
  }
}

/** Stores the position, or forgets it when `null`. Storage may be unavailable. */
export const writePosition = (
  storageKey: string,
  position: FeedbackPosition | null
): void => {
  try {
    if (position) {
      window.localStorage.setItem(
        STORAGE_PREFIX + storageKey,
        JSON.stringify(position)
      )
    } else {
      window.localStorage.removeItem(STORAGE_PREFIX + storageKey)
    }
  } catch {
    // Private mode or quota: the position only lasts for the session
  }
}

/** Nearest horizontal edge and vertical position of a button dropped there */
export const snapToEdge = (
  drop: { left: number; top: number },
  viewport: { width: number; height: number },
  bottomOffset: number,
  width = FAB_SIZE
): FeedbackPosition => ({
  side: drop.left + width / 2 < viewport.width / 2 ? 'left' : 'right',
  bottom: clampBottom(
    viewport.height - drop.top - FAB_SIZE,
    viewport.height,
    bottomOffset
  )
})

/**
 * Where the Sentry form opens, as the value of its `--inset` variable: from
 * the bottom of a button in the lower half of the viewport, upward, and from
 * the top of a button in the upper half, downward, so that it opens on the
 * side with the most room. Sideways it keeps to the edge of the button.
 */
// The form is not measured: one taller than the larger half still overflows
export const getFormInset = (
  { side, bottom }: FeedbackPosition,
  viewportHeight: number
): string => {
  const [right, left] =
    side === 'left'
      ? ['auto', `${EDGE_MARGIN}px`]
      : [`${EDGE_MARGIN}px`, 'auto']
  const top = viewportHeight - bottom - FAB_SIZE
  return top < bottom
    ? `${top}px ${right} auto ${left}`
    : `auto ${right} ${bottom}px ${left}`
}
