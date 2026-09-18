import { resolveChatSpaUrl } from './chatSpaUrl'

describe('resolveChatSpaUrl', () => {
  it('resolves a plain URL template', () => {
    const result = resolveChatSpaUrl('https://chat.example.com', {})
    expect(result).toBe('https://chat.example.com')
  })

  it('resolves a template with target placeholder', () => {
    const result = resolveChatSpaUrl(
      'https://chat.example.com/#/chat/@{target}',
      { target: '@bob:twake.app' }
    )
    expect(result).toBe('https://chat.example.com/#/chat/@@bob:twake.app')
  })

  it('returns null for an empty template', () => {
    expect(resolveChatSpaUrl('', {})).toBeNull()
  })
})
