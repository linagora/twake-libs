import React, { useEffect, useId, useRef, useState } from 'react'

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@linagora/twake-mui'
import { useExtendI18n, useI18n } from 'twake-i18n'

import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'
import { CHECK_VERSION_EVENT, fetchServedBuild, isNewBuild } from './version'

const locales: Record<string, typeof en> = { de, en, es, fr, it, ru, vi }

const MINUTE = 60_000
const MIN_GAP_MS = 30_000

export interface NewVersionDialogProps {
  /** The build id of this bundle, the one `/version.json` names once served */
  running: string
  /** The name shown in the text, such as `Twake Mail` */
  appName: string
  fetchServed?: () => Promise<string | null>
  reload?: () => void
  intervalMs?: number
}

/**
 * Runs `check` every `intervalMs`, and whenever the tab may have missed a
 * deployment: it gets the focus, becomes visible again, comes back online, or
 * the app asks for it (`requestVersionCheck`). Not at mount: the page just
 * loaded is the served build. One check at a time, and at most one per
 * `MIN_GAP_MS` but the ones the app asks for: a framed app gets the focus at
 * each click of its host
 */
const useVersionChecks = (
  check: () => Promise<void>,
  intervalMs: number
): void => {
  // The listeners stay in place while `check` changes with each render
  const latestCheck = useRef(check)
  latestCheck.current = check
  // Refs, not effect locals: the guard holds when `intervalMs` changes
  const isRunning = useRef(false)
  const lastRun = useRef(-Infinity)

  useEffect(() => {
    const run = (isAsked = false): void => {
      const now = Date.now()
      if (isRunning.current) return
      if (!isAsked && now - lastRun.current < MIN_GAP_MS) return
      isRunning.current = true
      lastRun.current = now
      void latestCheck.current().finally(() => {
        isRunning.current = false
      })
    }
    const onEvent = (): void => run()
    const onAsked = (): void => run(true)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') run()
    }
    const timer = window.setInterval(onEvent, intervalMs)
    const events = ['focus', 'online']
    events.forEach(name => window.addEventListener(name, onEvent))
    window.addEventListener(CHECK_VERSION_EVENT, onAsked)
    document.addEventListener('visibilitychange', onVisible)
    return (): void => {
      window.clearInterval(timer)
      events.forEach(name => window.removeEventListener(name, onEvent))
      window.removeEventListener(CHECK_VERSION_EVENT, onAsked)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])
}

/**
 * « New version available »: offers a reload to a tab that runs an older
 * build than the served one. « Not now », Escape or a click outside decline
 * that build for the life of the tab: the dialog comes back only for a build
 * not declined yet. Mount it once, under the app's `I18n` and twake-mui theme
 */
export const NewVersionDialog = ({
  running,
  appName,
  fetchServed = fetchServedBuild,
  reload = (): void => window.location.reload(),
  intervalMs = 10 * MINUTE
}: NewVersionDialogProps): React.ReactElement => {
  const { t, lang } = useI18n()
  useExtendI18n({ [lang]: locales[lang] ?? locales.en })
  const titleId = useId()
  const [offered, setOffered] = useState<string | null>(null)
  // Read only in events, never drawn: a ref, not state
  const declined = useRef(new Set<string>())

  useVersionChecks(async () => {
    if (offered !== null) return
    const served = await fetchServed().catch(() => null)
    if (isNewBuild(running, served) && !declined.current.has(served)) {
      setOffered(served)
    }
  }, intervalMs)

  const notNow = (): void => {
    if (offered !== null) declined.current.add(offered)
    setOffered(null)
  }

  return (
    <Dialog
      open={offered !== null}
      onClose={notNow}
      size="small"
      aria-labelledby={titleId}
      data-testid="new-version-dialog"
    >
      <DialogTitle id={titleId}>{t('twakeNewVersion.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {/* The typings of twake-i18n's `t` take no interpolation options */}
          {t('twakeNewVersion.body').replace('%{appName}', appName)}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          data-testid="new-version-not-now"
          onClick={notNow}
        >
          {t('twakeNewVersion.notNow')}
        </Button>
        <Button
          variant="contained"
          color="primary"
          data-testid="new-version-reload"
          onClick={reload}
        >
          {t('twakeNewVersion.reload')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
