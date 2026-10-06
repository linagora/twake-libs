import { createWebSocketConnection } from '../connection/createConnection'
import { WebSocketCallbacks, WebSocketWithCleanup } from '../connection/types'

export async function establishWebSocketConnection(
  url: string,
  callbacks: WebSocketCallbacks,
  socketRef: React.MutableRefObject<WebSocketWithCleanup | null>,
  setIsSocketOpen: (value: boolean) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const socket = await createWebSocketConnection({ url, callbacks })

    if (signal?.aborted) {
      socket.cleanup()
      socket.close()
      return
    }

    socketRef.current = socket

    if (socket.readyState === WebSocket.OPEN) {
      setIsSocketOpen(true)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to create WebSocket connection:', error)
    setIsSocketOpen(false)
  }
}
