import { resolveUriTemplate, UriTemplateContext } from './uriTemplateUtils'

/**
 * Resolve a chat SPA URL template.
 *
 * The template supports RFC 6570-style expressions, including {target}.
 * See {@link resolveUriTemplate} for supported placeholders.
 *
 * @param template - The URL template (e.g. 'https://chat.example.com/#/chat/@{target}')
 * @param context - Optional context for template resolution
 * @returns the resolved URL, or null when template is empty
 */
export function resolveChatSpaUrl(
  template: string,
  context: UriTemplateContext = {}
): string | null {
  if (!template) return null

  return resolveUriTemplate(template, context)
}
