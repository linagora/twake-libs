import type { KyInstance } from 'ky'

import { WebSocketTicket } from './types'

export async function fetchWebSocketTicket(
  api: KyInstance,
  ticketUrl: string = 'ws/ticket'
): Promise<WebSocketTicket> {
  const response = await api.post(ticketUrl)

  if (!response.ok) {
    throw new Error('Failed to fetch WebSocket ticket')
  }

  return response.json()
}
