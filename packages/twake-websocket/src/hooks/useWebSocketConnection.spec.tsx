import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WebSocketCallbacks } from '../connection'
import {
  closeWebSocketConnection,
  establishWebSocketConnection,
  setupWebSocketPing
} from '../lifecycle'
import { useWebSocketConnection } from './useWebSocketConnection'

vi.mock('../lifecycle', () => ({
  establishWebSocketConnection: vi.fn(),
  closeWebSocketConnection: vi.fn(),
  setupWebSocketPing: vi.fn(() => ({ stop: vi.fn() }))
}))

const mockEstablish = vi.mocked(establishWebSocketConnection)

// Stable like a real app's client: `api` is a dependency of the connection
const API = {} as never

let callbacks: WebSocketCallbacks
let setIsSocketOpen: (open: boolean) => void

const setVisibility = (state: DocumentVisibilityState): void => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
  document.dispatchEvent(new Event('visibilitychange'))
}

const renderConnection = (): ReturnType<
  typeof renderHook<ReturnType<typeof useWebSocketConnection>, unknown>
> =>
  renderHook(() =>
    useWebSocketConnection({
      enabled: true,
      url: 'wss://example.test',
      api: API,
      onMessage: vi.fn()
    })
  )

describe('useWebSocketConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(closeWebSocketConnection).mockImplementation((_ref, setOpen) =>
      setOpen(false)
    )
    vi.mocked(setupWebSocketPing).mockReturnValue({ stop: vi.fn() } as never)
    mockEstablish.mockImplementation(
      (_url, _api, socketCallbacks, _socketRef, setOpen) => {
        callbacks = socketCallbacks
        setIsSocketOpen = setOpen
        return Promise.resolve()
      }
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    mockEstablish.mockReset()
  })

  it('clears the error once the socket is open again', async () => {
    const { result } = renderConnection()
    await act(async () => {})

    act(() => callbacks.onError?.(new Event('error')))
    expect(result.current.error).not.toBe(null)

    act(() => setIsSocketOpen(true))
    expect(result.current.error).toBe(null)
  })

  it('reconnects when a closed tab becomes visible again', async () => {
    renderConnection()
    await act(async () => {})
    expect(mockEstablish).toHaveBeenCalledTimes(1)

    act(() => {
      setVisibility('hidden')
    })
    expect(mockEstablish).toHaveBeenCalledTimes(1)

    act(() => {
      setVisibility('visible')
    })
    expect(mockEstablish).toHaveBeenCalledTimes(2)
  })

  it('does not reconnect a visible tab whose socket is open', async () => {
    renderConnection()
    await act(async () => {})
    act(() => setIsSocketOpen(true))

    act(() => {
      setVisibility('visible')
    })
    expect(mockEstablish).toHaveBeenCalledTimes(1)
  })
  describe('browser online/offline events', () => {
    const closeAbnormally = (): void => {
      act(() => {
        callbacks.onClose?.(new CloseEvent('close', { code: 1006 }))
      })
    }

    it('reconnects at once when the browser goes online', async () => {
      renderConnection()
      await act(async () => {})
      closeAbnormally()

      act(() => {
        window.dispatchEvent(new Event('online'))
      })
      expect(mockEstablish).toHaveBeenCalledTimes(2)
    })

    it('stops reconnecting while the browser is offline', async () => {
      renderConnection()
      await act(async () => {})
      closeAbnormally()

      act(() => {
        window.dispatchEvent(new Event('offline'))
      })
      act(() => {
        vi.advanceTimersByTime(10_000)
      })
      expect(mockEstablish).toHaveBeenCalledTimes(1)
    })

    it('does not reconnect when online fires on an open socket', async () => {
      renderConnection()
      await act(async () => {})
      act(() => setIsSocketOpen(true))

      act(() => {
        window.dispatchEvent(new Event('online'))
      })
      expect(mockEstablish).toHaveBeenCalledTimes(1)
    })

    it('resets the reconnection attempts when the browser goes online', async () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => {})
      renderConnection()
      await act(async () => {})

      closeAbnormally()
      await act(async () => {
        // Past the first retry, before the 10 s connection timeout
        await vi.advanceTimersByTimeAsync(2_000)
      })
      closeAbnormally()
      expect(info).toHaveBeenLastCalledWith(
        expect.stringContaining('(attempt 2/10)')
      )

      act(() => {
        window.dispatchEvent(new Event('offline'))
        window.dispatchEvent(new Event('online'))
      })
      closeAbnormally()
      expect(info).toHaveBeenLastCalledWith(
        expect.stringContaining('(attempt 1/10)')
      )
    })
  })
})
