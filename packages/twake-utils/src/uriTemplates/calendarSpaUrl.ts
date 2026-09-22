import { resolveUriTemplate, UriTemplateContext } from './uriTemplateUtils'

/**
 * Resolve a calendar SPA URL template.
 *
 * The template supports RFC 6570-style expressions.
 * See {@link resolveUriTemplate} for supported placeholders.
 *
 * @param template - The URL template (e.g. 'https://calendar.{workplaceFqdn}')
 * @param context - Optional context for template resolution
 * @returns the resolved URL, or null when template is empty
 */
export function resolveCalendarSpaUrl(
  template: string,
  context: UriTemplateContext = {}
): string | null {
  if (!template) return null

  return resolveUriTemplate(template, context)
}

/**
 * Build the full calendar event creation URL for a given attendee.
 *
 * @param calendarSpaUrl - The resolved calendar SPA base URL
 * @param attendee - The attendee email address
 * @returns The full event creation URL
 */
export function buildCalendarEventUrl(
  calendarSpaUrl: string,
  attendee: string
): string {
  return `${calendarSpaUrl}/newEvent?attendee=${encodeURIComponent(attendee)}`
}

/**
 * Generate a complete calendar event creation URL from a template.
 *
 * Combines template resolution and event URL building into a single call.
 *
 * @param template - The URL template (e.g. 'https://calendar.{workplaceFqdn}')
 * @param attendee - The attendee email address
 * @param context - Optional context for template resolution
 * @returns The full event creation URL, or null if template is empty
 */
export function generateCalendarEventUrl(
  template: string,
  attendee: string,
  context: UriTemplateContext = {}
): string | null {
  const calendarSpaUrl = resolveCalendarSpaUrl(template, context)
  if (!calendarSpaUrl) return null

  return buildCalendarEventUrl(calendarSpaUrl, attendee)
}
