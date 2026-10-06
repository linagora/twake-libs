import { useExtendI18n } from 'twake-i18n'

import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'

const locales = { en, es, fr, it, ru, vi }

/** Adds the bar strings to the host i18n, like the twake-mui components do */
export const useBarLocales = (): void => useExtendI18n(locales)
