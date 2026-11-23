import React, { useEffect, useState } from 'react'

import { WebSocketStatusSnackbar } from './WebSocketStatusSnackbar'

/** Time a socket error must last, tab visible, before it is shown. */
export const DEFAULT_ERROR_SHOW_DELAY_MS = 5_000

export interface WebSocketErrorSnackbarProps {
  error: Event | null
  onClose: () => void
  /** The app owns i18n: it turns the raw error into a message. */
  formatMessage: (error: Event) => string
  showDelayMs?: number
}

function isDocumentVisible(): boolean {
  return document.visibilityState === 'visible'
}

function useIsDocumentVisible(): boolean {
  const [isVisible, setIsVisible] = useState(isDocumentVisible)
  useEffect(() => {
    const handleVisibilityChange = (): void => setIsVisible(isDocumentVisible())
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return (): void => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
  return isVisible
}

/**
 * Shows a socket error only when it outlasts `showDelayMs` with the tab
 * visible: a tab waking up from sleep reconnects in that time, and the
 * connection clears its error once open, so the user never sees it.
 */
export function WebSocketErrorSnackbar({
  error,
  onClose,
  formatMessage,
  showDelayMs = DEFAULT_ERROR_SHOW_DELAY_MS
}: WebSocketErrorSnackbarProps): React.JSX.Element | null {
  const isVisible = useIsDocumentVisible()
  const [shownError, setShownError] = useState<Event | null>(null)

  useEffect(() => {
    setShownError(null)
    if (!error || !isVisible) return
    const timeout = setTimeout(() => setShownError(error), showDelayMs)
    return (): void => clearTimeout(timeout)
  }, [error, isVisible, showDelayMs])

  if (!shownError) return null
  return (
    <WebSocketStatusSnackbar
      message={formatMessage(shownError)}
      severity="error"
      onClose={onClose}
    />
  )
}
