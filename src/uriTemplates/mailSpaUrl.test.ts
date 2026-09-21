import {
  resolveMailSpaUrl,
  buildMailComposerUrl,
  generateMailComposerUrl
} from './mailSpaUrl'

describe('resolveMailSpaUrl', () => {
  it('resolves a plain URL template', () => {
    const result = resolveMailSpaUrl('https://mail.example.com', {})
    expect(result).toBe('https://mail.example.com')
  })

  it('resolves a template with placeholders', () => {
    const result = resolveMailSpaUrl('https://mail.{workplaceFqdn}', {
      workplaceFqdn: 'alice.twake.app'
    })
    expect(result).toBe('https://mail.alice.twake.app')
  })

  it('returns null for an empty template', () => {
    expect(resolveMailSpaUrl('', {})).toBeNull()
  })
})

describe('buildMailComposerUrl', () => {
  it('builds a composer URL for a recipient', () => {
    const result = buildMailComposerUrl(
      'https://mail.example.com',
      'bob@example.com'
    )
    expect(result).toBe(
      'https://mail.example.com/mailto/?uri=mailto%3Abob%40example.com'
    )
  })
})

describe('generateMailComposerUrl', () => {
  it('generates a complete composer URL from template', () => {
    const result = generateMailComposerUrl(
      'https://mail.{workplaceFqdn}',
      'bob@example.com',
      { workplaceFqdn: 'alice.twake.app' }
    )
    expect(result).toBe(
      'https://mail.alice.twake.app/mailto/?uri=mailto%3Abob%40example.com'
    )
  })

  it('returns null for an empty template', () => {
    const result = generateMailComposerUrl('', 'bob@example.com', {})
    expect(result).toBeNull()
  })
})
