import { describe, expect, it } from 'vitest'

import {
  formatAvailableGigabytes,
  getAppDisplayName,
  getEntrypoints,
  sortApps
} from './helpers'
import { makeApp } from './testUtils'

describe('getAppDisplayName', () => {
  it('translates the name and drops the platform prefix', () => {
    const app = makeApp({
      slug: 'drive',
      name: 'Drive',
      name_prefix: 'Twake',
      locales: { fr: { name: 'Fichiers' } }
    })

    expect(getAppDisplayName(app, 'fr')).toBe('Fichiers')
    expect(getAppDisplayName(app, 'en')).toBe('Drive')
    expect(
      getAppDisplayName(
        makeApp({ slug: 'x', name: 'Pass', name_prefix: 'Acme' }),
        'en'
      )
    ).toBe('Acme Pass')
  })
})

describe('sortApps', () => {
  it('puts the ordered slugs first and keeps the others after', () => {
    const apps = ['c', 'a', 'b', 'd'].map(slug => makeApp({ slug }))

    expect(sortApps(apps, ['b', 'a']).map(app => app.slug)).toEqual([
      'b',
      'a',
      'c',
      'd'
    ])
  })
})

describe('getEntrypoints', () => {
  it('keeps the entrypoints whose flag conditions hold', () => {
    const apps = [
      makeApp({
        slug: 'contacts',
        entrypoints: [
          { name: 'groups', title: { en: 'Groups' }, hash: '/groups' },
          {
            name: 'beta',
            title: { en: 'Beta' },
            hash: '/beta',
            conditions: [{ type: 'flag', name: 'contacts.beta', value: true }]
          }
        ]
      })
    ]

    expect(getEntrypoints(apps, {}).map(entrypoint => entrypoint.name)).toEqual(
      ['groups']
    )
    expect(
      getEntrypoints(apps, { 'contacts.beta': true }).map(
        e => e.slug + '/' + e.name
      )
    ).toEqual(['contacts/groups', 'contacts/beta'])
  })
})

describe('formatAvailableGigabytes', () => {
  it('rounds to two decimals and assumes 100 GB without a quota', () => {
    expect(formatAvailableGigabytes(25e9, 100e9)).toBe('75')
    expect(formatAvailableGigabytes(1.5e9, 5e9)).toBe('3.50')
    expect(formatAvailableGigabytes(40e9, null)).toBe('60')
  })
})
