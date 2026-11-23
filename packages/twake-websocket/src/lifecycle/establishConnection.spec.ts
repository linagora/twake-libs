import type { KyInstance } from 'ky'
import type { MutableRefObject } from 'react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
  type MockInstance
} from 'vitest'

import { buildWebSocketUrl } from '../api/buildUrl'
import { fetchWebSocketTicket } from '../api/fetchTicket'
import { createWebSocketConnection } from '../connection/createConnection'
import { WebSocketCallbacks, WebSocketWithCleanup } from '../connection/types'
import { establishWebSocketConnection } from './establishConnection'

vi.mock('../api/buildUrl')
vi.mock('../api/fetchTicket')
vi.mock('../connection/createConnection')

const mockFetchTicket = vi.mocked(fetchWebSocketTicket)
const mockBuildUrl = vi.mocked(buildWebSocketUrl)
const mockCreateConnection = vi.mocked(createWebSocketConnection)

const createMockSocket = (
  readyState: number = WebSocket.OPEN,
  cleanup = vi.fn(),
  close = vi.fn()
): WebSocketWithCleanup =>
  ({ readyState, cleanup, close }) as unknown as WebSocketWithCleanup

describe('establishWebSocketConnection', () => {
  const baseUrl = 'wss://example.com/ws'
  const api = {} as KyInstance
  const callbacks = {
    onMessage: vi.fn(),
    onClose: vi.fn(),
    onError: vi.fn()
  } as unknown as WebSocketCallbacks

  let socketRef: MutableRefObject<WebSocketWithCleanup | null>
  let setIsSocketOpen: Mock<(value: boolean) => void>
  let consoleErrorSpy: MockInstance<typeof console.error>

  beforeEach(() => {
    socketRef = { current: null }
    setIsSocketOpen = vi.fn()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockFetchTicket.mockResolvedValue({ value: 'ticket-123' } as never)
    mockBuildUrl.mockReturnValue('wss://example.com/ws?ticket=ticket-123')
    mockCreateConnection.mockResolvedValue(createMockSocket())
  })

  afterEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy.mockRestore()
  })

  describe('successful connection', () => {
    it('should fetch a ticket, build the url and create the connection', async () => {
      await establishWebSocketConnection(
        baseUrl,
        api,
        callbacks,
        socketRef,
        setIsSocketOpen
      )

      expect(mockFetchTicket).toHaveBeenCalledWith(api, undefined)
      expect(mockBuildUrl).toHaveBeenCalledWith(baseUrl, 'ticket-123')
      expect(mockCreateConnection).toHaveBeenCalledWith({
        url: 'wss://example.com/ws?ticket=ticket-123',
        callbacks
      })
    })

    it('should forward a custom ticketUrl to fetchWebSocketTicket', async () => {
      await establishWebSocketConnection(
        baseUrl,
        api,
        callbacks,
        socketRef,
        setIsSocketOpen,
        undefined,
        '/custom/ticket'
      )

      expect(mockFetchTicket).toHaveBeenCalledWith(api, '/custom/ticket')
    })

    it('should store the socket in socketRef and flag it as open', async () => {
      const socket = createMockSocket(WebSocket.OPEN)
      mockCreateConnection.mockResolvedValue(socket)

      await establishWebSocketConnection(
        baseUrl,
        api,
        callbacks,
        socketRef,
        setIsSocketOpen
      )

      expect(socketRef.current).toBe(socket)
      expect(setIsSocketOpen).toHaveBeenCalledWith(true)
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('should store the socket but not flag it as open if it is not OPEN yet', async () => {
      const socket = createMockSocket(WebSocket.CONNECTING)
      mockCreateConnection.mockResolvedValue(socket)

      await establishWebSocketConnection(
        baseUrl,
        api,
        callbacks,
        socketRef,
        setIsSocketOpen
      )

      expect(socketRef.current).toBe(socket)
      expect(setIsSocketOpen).not.toHaveBeenCalled()
    })
  })

  describe('abort handling', () => {
    it('should cleanup and close the socket if aborted during connection', async () => {
      const cleanup = vi.fn()
      const close = vi.fn()
      const socket = createMockSocket(WebSocket.OPEN, cleanup, close)
      const controller = new AbortController()
      mockCreateConnection.mockImplementation(() => {
        controller.abort()
        return Promise.resolve(socket)
      })

      await establishWebSocketConnection(
        baseUrl,
        api,
        callbacks,
        socketRef,
        setIsSocketOpen,
        controller.signal
      )

      expect(cleanup).toHaveBeenCalledTimes(1)
      expect(close).toHaveBeenCalledTimes(1)
      expect(socketRef.current).toBeNull()
      expect(setIsSocketOpen).not.toHaveBeenCalled()
    })

    it('should keep the socket if the signal is not aborted', async () => {
      const cleanup = vi.fn()
      const close = vi.fn()
      const socket = createMockSocket(WebSocket.OPEN, cleanup, close)
      mockCreateConnection.mockResolvedValue(socket)
      const controller = new AbortController()

      await establishWebSocketConnection(
        baseUrl,
        api,
        callbacks,
        socketRef,
        setIsSocketOpen,
        controller.signal
      )

      expect(cleanup).not.toHaveBeenCalled()
      expect(close).not.toHaveBeenCalled()
      expect(socketRef.current).toBe(socket)
    })
  })

  describe('error handling', () => {
    it('should log and flag the socket as closed when the ticket fetch fails', async () => {
      const error = new Error('ticket failed')
      mockFetchTicket.mockRejectedValue(error)

      await expect(
        establishWebSocketConnection(
          baseUrl,
          api,
          callbacks,
          socketRef,
          setIsSocketOpen
        )
      ).resolves.toBeUndefined()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create WebSocket connection:',
        error
      )
      expect(setIsSocketOpen).toHaveBeenCalledWith(false)
      expect(mockCreateConnection).not.toHaveBeenCalled()
      expect(socketRef.current).toBeNull()
    })

    it('should log and flag the socket as closed when the connection fails', async () => {
      const error = new Error('connection failed')
      mockCreateConnection.mockRejectedValue(error)

      await expect(
        establishWebSocketConnection(
          baseUrl,
          api,
          callbacks,
          socketRef,
          setIsSocketOpen
        )
      ).resolves.toBeUndefined()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create WebSocket connection:',
        error
      )
      expect(setIsSocketOpen).toHaveBeenCalledWith(false)
      expect(socketRef.current).toBeNull()
    })
  })
})
