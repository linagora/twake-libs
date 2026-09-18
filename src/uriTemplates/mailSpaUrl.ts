import { resolveUriTemplate, UriTemplateContext } from './uriTemplateUtils'

/**
 * Resolve a mail SPA URL template.
 *
 * The template supports RFC 6570-style expressions.
 * See {@link resolveUriTemplate} for supported placeholders.
 *
 * @param template - The URL template (e.g. 'https://mail.{workplaceFqdn}')
 * @param context - Optional context for template resolution
 * @returns the resolved URL, or null when template is empty
 */
export function resolveMailSpaUrl(
  template: string,
  context: UriTemplateContext = {}
): string | null {
  if (!template) return null

  return resolveUriTemplate(template, context)
}

/**
 * Build the full mail composer URL for a given recipient.
 *
 * @param mailSpaUrl - The resolved mail SPA base URL
 * @param recipient - The recipient email address
 * @returns The full composer URL
 */
export function buildMailComposerUrl(
  mailSpaUrl: string,
  recipient: string
): string {
  return `${mailSpaUrl}/mailto/?uri=${encodeURIComponent(`mailto:${recipient}`)}`
}
