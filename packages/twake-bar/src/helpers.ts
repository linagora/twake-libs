import type { App, Entrypoint, Flags } from '@linagora/twake-sdk'

export interface AppEntrypoint extends Entrypoint {
  slug: string
}

/** Translated prefix and name of the app, without the platform prefix */
export function getAppDisplayName(app: App, lang: string): string {
  const name = app.locales?.[lang]?.name ?? app.name
  const prefix = app.locales?.[lang]?.name_prefix ?? app.name_prefix
  if (!prefix || ['cozy', 'twake'].includes(prefix.toLowerCase())) return name
  return `${prefix} ${name}`
}

/** The apps of `slugsOrder` first, in that order, then the others */
export function sortApps(apps: App[], slugsOrder: string[]): App[] {
  const rank = (app: App): number => {
    const index = slugsOrder.indexOf(app.slug)
    return index === -1 ? slugsOrder.length : index
  }
  return [...apps].sort((a, b) => rank(a) - rank(b))
}

/** Entrypoints of the apps whose flag conditions hold */
export function getEntrypoints(apps: App[], flags: Flags): AppEntrypoint[] {
  return apps.flatMap(app =>
    (app.entrypoints ?? [])
      .filter(entrypoint =>
        (entrypoint.conditions ?? []).every(
          condition =>
            condition.type === 'flag' &&
            flags[condition.name] === condition.value
        )
      )
      .map(entrypoint => ({ ...entrypoint, slug: app.slug }))
  )
}
