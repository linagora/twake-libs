export interface WebSocketWithCleanup extends WebSocket {
  cleanup: () => void
}

export interface WebSocketCallbacks {
  onMessage: (data: unknown) => void
  onClose?: (event: CloseEvent) => void
  onError?: (error: Event) => void
}

export interface CreateConnectionOptions {
  url: string
  callbacks: WebSocketCallbacks
  connectionTimeoutMs?: number
}
