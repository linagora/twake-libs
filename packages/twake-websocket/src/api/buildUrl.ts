export function buildWebSocketUrl(
  baseUrl: string,
  ticketValue: string
): string {
  const wsBaseUrl = baseUrl.replace(
    /^http(s)?:/,
    (_: string, s: string | undefined) => (s ? 'wss:' : 'ws:')
  )

  if (!wsBaseUrl) {
    throw new Error('WEBSOCKET_URL is not defined')
  }
  return `${wsBaseUrl}/ws?ticket=${encodeURIComponent(ticketValue)}`
}
