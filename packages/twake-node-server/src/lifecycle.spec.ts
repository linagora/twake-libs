import { EventEmitter } from 'node:events'

import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest'

import { handleSignals, type Lifecycle } from './lifecycle.js'

const log = { info: vi.fn(), error: vi.fn() }

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function setUp(): {
  signals: EventEmitter
  exit: Mock<(code: number) => void>
  lifecycle: Lifecycle
} {
  const signals = new EventEmitter()
  const exit = vi.fn<(code: number) => void>()
  const lifecycle = handleSignals({ log, signals, exit, deadlineMs: 1000 })
  return { signals, exit, lifecycle }
}

it('exits at once on a signal during startup', () => {
  const { signals, exit } = setUp()

  signals.emit('SIGTERM', 'SIGTERM')

  expect(exit).toHaveBeenCalledWith(0)
})

it('stops once started, then exits', async () => {
  const { signals, exit, lifecycle } = setUp()
  const stop = vi.fn(() => Promise.resolve())
  lifecycle.started(stop)

  signals.emit('SIGTERM', 'SIGTERM')
  signals.emit('SIGINT', 'SIGINT')
  await vi.runAllTimersAsync()

  expect(stop).toHaveBeenCalledOnce()
  expect(exit).toHaveBeenCalledWith(0)
})

it('ignores a repeated signal while stopping', async () => {
  const { signals, exit, lifecycle } = setUp()
  const stop = vi.fn(() => Promise.resolve())
  lifecycle.started(stop)

  signals.emit('SIGINT', 'SIGINT')
  signals.emit('SIGINT', 'SIGINT')
  await vi.runAllTimersAsync()

  expect(signals.listenerCount('SIGINT')).toBe(1)
  expect(stop).toHaveBeenCalledOnce()
  expect(exit).toHaveBeenCalledExactlyOnceWith(0)
})

it('exits with an error when stopping fails', async () => {
  const { signals, exit, lifecycle } = setUp()
  lifecycle.started(() => Promise.reject(new Error('broker gone')))

  signals.emit('SIGTERM', 'SIGTERM')
  await vi.runAllTimersAsync()

  expect(exit).toHaveBeenCalledWith(1)
})

it('exits with an error when stopping outlives the deadline', async () => {
  const { signals, exit, lifecycle } = setUp()
  lifecycle.started(() => new Promise(() => undefined))

  signals.emit('SIGTERM', 'SIGTERM')
  await vi.advanceTimersByTimeAsync(999)
  expect(exit).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)

  expect(exit).toHaveBeenCalledWith(1)
})
