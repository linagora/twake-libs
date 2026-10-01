/**
 * Encodes a value, typically an event UID, as a single segment of a DAV path.
 *
 * The UID of an event comes from whoever wrote it, the sender of an
 * invitation included, and may hold "/", "?", "#" or "%" which would change
 * the path it is put in. Encodes like Sabre's encodePath, which writes the
 * hrefs the server hands back, so that the path of an ordinary UID ("@" and
 * ":" included) stays the very string the server uses.
 */
export function encodeDavSegment(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!*']/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%40/g, '@')
    .replace(/%3A/gi, ':')
}
