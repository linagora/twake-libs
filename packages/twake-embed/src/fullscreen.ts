// The browser's full screen, from inside the frame. Not the page of
// TwakeSpace, which `fillPage` asks TwakeSpace for: here the browser puts an
// element of the app over the whole screen, as a video player does. It works
// in a frame only if TwakeSpace granted it (`allow="fullscreen"` on the
// frame), and only from a user gesture.

/** Whether the browser lets this document go full screen: TwakeSpace granted it */
export function canGoFullscreen(doc: Document = document): boolean {
  return (
    doc.fullscreenEnabled === true && typeof doc.exitFullscreen === 'function'
  )
}

/**
 * Puts `element` (the whole app by default) over the whole screen. Resolves
 * once done, rejects when the browser refuses: no gesture, or TwakeSpace did
 * not grant `fullscreen` to the frame.
 */
export function requestFullscreen(
  element: Element = document.documentElement
): Promise<void> {
  return element.requestFullscreen()
}

/** Leaves the browser's full screen, if this document is in it */
export async function exitFullscreen(doc: Document = document): Promise<void> {
  if (doc.fullscreenElement !== null) await doc.exitFullscreen()
}
