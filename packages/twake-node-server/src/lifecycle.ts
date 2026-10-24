import type { EventEmitter } from 'node:events'

export interface LifecycleLog {
  info: (object: object, message: string) => void
  error: (object: object, message: string) => void
}

export interface Lifecycle {
  // Called once the service serves traffic, with what stops it cleanly.
  started: (stop: () => Promise<void>) => void
}

// Before `started`, nothing serves traffic or holds a delivery, and an
// unfinished migration rolls back, so a signal ends the process right away.
export function handleSignals(options: {
  log: LifecycleLog
  deadlineMs: number
  signals?: EventEmitter
  exit?: (code: number) => void
}): Lifecycle {
  const { log, deadlineMs } = options
  const signals = options.signals ?? process
  const exit = options.exit ?? ((code: number): never => process.exit(code))
  let stop: (() => Promise<void>) | undefined
  let stopping = false

  const onSignal = (signal: string): void => {
    if (stopping) return
    stopping = true
    if (!stop) {
      log.info({ signal }, 'stopped during startup')
      exit(0)
      return
    }
    log.info({ signal }, 'shutting down')
    const deadline = setTimeout(() => {
      log.error({ deadlineMs }, 'shutdown took too long')
      exit(1)
    }, deadlineMs).unref()
    stop()
      .finally(() => clearTimeout(deadline))
      .then(() => exit(0))
      .catch((error: unknown) => {
        log.error({ err: error }, 'shutdown failed')
        exit(1)
      })
  }
  // Kept for every signal, so a repeated one does not fall back to Node's
  // default handler and kill the process mid-shutdown.
  signals.on('SIGTERM', onSignal)
  signals.on('SIGINT', onSignal)

  return {
    started(fn): void {
      stop = fn
    }
  }
}
