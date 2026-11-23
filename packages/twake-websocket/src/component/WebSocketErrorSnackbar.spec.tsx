import { act, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import { I18n } from 'twake-i18n'

import { WebSocketErrorSnackbar } from './WebSocketErrorSnackbar'

const DELAY = 5_000
const MESSAGE = 'Connection lost'

const setVisibility = (state: DocumentVisibilityState): void => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
  document.dispatchEvent(new Event('visibilitychange'))
}

const snackbar = (error: Event | null): React.ReactElement => (
  <TwakeMuiThemeProvider>
    <I18n lang="en" dictRequire={(): Record<string, unknown> => ({})}>
      <WebSocketErrorSnackbar
        error={error}
        onClose={vi.fn()}
        formatMessage={(): string => MESSAGE}
        showDelayMs={DELAY}
      />
    </I18n>
  </TwakeMuiThemeProvider>
)

describe('WebSocketErrorSnackbar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows an error that outlasts the delay', () => {
    render(snackbar(new Event('error')))
    expect(screen.queryByText(MESSAGE)).toBe(null)

    act(() => {
      vi.advanceTimersByTime(DELAY)
    })
    expect(screen.queryByText(MESSAGE)).toBeTruthy()
  })

  it('never shows an error cleared within the delay', () => {
    const { rerender } = render(snackbar(new Event('error')))
    act(() => {
      vi.advanceTimersByTime(DELAY - 1)
    })
    rerender(snackbar(null))

    act(() => {
      vi.advanceTimersByTime(DELAY)
    })
    expect(screen.queryByText(MESSAGE)).toBe(null)
  })

  it('never shows an error while the tab is hidden', () => {
    setVisibility('hidden')
    render(snackbar(new Event('error')))

    act(() => {
      vi.advanceTimersByTime(DELAY * 10)
    })
    expect(screen.queryByText(MESSAGE)).toBe(null)
  })

  it('waits the delay again after the tab wakes up', () => {
    setVisibility('hidden')
    const { rerender } = render(snackbar(new Event('error')))
    act(() => {
      setVisibility('visible')
    })

    act(() => {
      vi.advanceTimersByTime(DELAY - 1)
    })
    expect(screen.queryByText(MESSAGE)).toBe(null)

    // The connection recovered on wake-up and cleared its error
    rerender(snackbar(null))
    act(() => {
      vi.advanceTimersByTime(DELAY)
    })
    expect(screen.queryByText(MESSAGE)).toBe(null)
  })
})
