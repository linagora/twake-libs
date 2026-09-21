import {
  resolveCalendarSpaUrl,
  buildCalendarEventUrl,
  generateCalendarEventUrl
} from './calendarSpaUrl'

describe('resolveCalendarSpaUrl', () => {
  it('resolves a plain URL template', () => {
    const result = resolveCalendarSpaUrl('https://calendar.example.com', {})
    expect(result).toBe('https://calendar.example.com')
  })

  it('resolves a template with placeholders', () => {
    const result = resolveCalendarSpaUrl('https://calendar.{workplaceFqdn}', {
      workplaceFqdn: 'alice.twake.app'
    })
    expect(result).toBe('https://calendar.alice.twake.app')
  })

  it('returns null for an empty template', () => {
    expect(resolveCalendarSpaUrl('', {})).toBeNull()
  })
})

describe('buildCalendarEventUrl', () => {
  it('builds an event creation URL for an attendee', () => {
    const result = buildCalendarEventUrl(
      'https://calendar.example.com',
      'bob@example.com'
    )
    expect(result).toBe(
      'https://calendar.example.com/newEvent?attendee=bob%40example.com'
    )
  })
})

describe('generateCalendarEventUrl', () => {
  it('generates a complete event URL from template', () => {
    const result = generateCalendarEventUrl(
      'https://calendar.{workplaceFqdn}',
      'bob@example.com',
      { workplaceFqdn: 'alice.twake.app' }
    )
    expect(result).toBe(
      'https://calendar.alice.twake.app/newEvent?attendee=bob%40example.com'
    )
  })

  it('returns null for an empty template', () => {
    const result = generateCalendarEventUrl('', 'bob@example.com', {})
    expect(result).toBeNull()
  })
})
