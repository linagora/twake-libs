import { pino, type Logger } from 'pino'
import { expect, it } from 'vitest'

import { createServer } from './server.js'

function capturedLogs(): { lines: Record<string, unknown>[]; logger: Logger } {
  const lines: Record<string, unknown>[] = []
  const logger = pino(
    { level: 'info' },
    {
      write: (line: string): void => {
        lines.push(JSON.parse(line) as Record<string, unknown>)
      }
    }
  )
  return { lines, logger }
}

const ready = (): Promise<boolean> => Promise.resolve(true)

it('answers a bare 500 and logs the error behind it', async () => {
  const { lines, logger } = capturedLogs()
  const app = createServer({ logger, isReady: ready })
  app.get('/boom', () => {
    throw new Error('connect ECONNREFUSED 10.0.0.7:5432')
  })

  const response = await app.inject({ method: 'GET', url: '/boom' })

  expect(response.statusCode).toBe(500)
  expect(response.json()).toEqual({ error: 'server_error' })
  expect(JSON.stringify(lines)).toContain('ECONNREFUSED 10.0.0.7')
})

it('keeps the answer of an error made for the client', async () => {
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: ready
  })
  app.post('/echo', () => 'ok')

  const response = await app.inject({
    method: 'POST',
    url: '/echo',
    headers: { 'content-type': 'application/json' },
    payload: '{'
  })

  expect(response.statusCode).toBe(400)
})

it('logs the path of a request without its query string', async () => {
  const { lines, logger } = capturedLogs()
  const app = createServer({ logger, isReady: ready })
  app.get('/link-preview', () => 'ok')

  await app.inject({
    method: 'GET',
    url: '/link-preview?url=https%3A%2F%2Fexample.com%2Fprivate'
  })

  expect(JSON.stringify(lines)).toContain('"url":"/link-preview"')
  expect(JSON.stringify(lines)).not.toContain('example.com')
})

it('logs an unknown route without its query string', async () => {
  const { lines, logger } = capturedLogs()
  const app = createServer({ logger, isReady: ready })

  const response = await app.inject({
    method: 'GET',
    url: '/nowhere?q=private'
  })

  expect(response.statusCode).toBe(404)
  expect(JSON.stringify(lines)).toContain('Route GET:/nowhere not found')
  expect(JSON.stringify(lines)).not.toContain('private')
})

it('does not log health checks', async () => {
  const { lines, logger } = capturedLogs()
  const app = createServer({ logger, isReady: ready })

  await app.inject({ method: 'GET', url: '/health/live' })

  expect(lines).toEqual([])
})

it.each([
  [true, 200],
  [false, 503]
])('answers readiness %s with %i', async (isReady, status) => {
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: () => Promise.resolve(isReady)
  })

  const response = await app.inject({ method: 'GET', url: '/health/ready' })

  expect(response.statusCode).toBe(status)
})

it('answers 503 on readiness when the check throws', async () => {
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: () => Promise.reject(new Error('database gone'))
  })

  const response = await app.inject({ method: 'GET', url: '/health/ready' })

  expect(response.statusCode).toBe(503)
})

it('answers 503 on liveness once the process is no longer alive', async () => {
  let alive = true
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: ready,
    isAlive: () => alive
  })
  const live = (): Promise<number> =>
    app
      .inject({ method: 'GET', url: '/health/live' })
      .then(response => response.statusCode)

  expect(await live()).toBe(200)
  alive = false
  expect(await live()).toBe(503)
})

it('passes Fastify options through', async () => {
  const app = createServer({
    logger: pino({ level: 'silent' }),
    isReady: ready,
    fastify: { routerOptions: { ignoreTrailingSlash: true } }
  })
  app.get('/users', () => 'ok')

  const response = await app.inject({ method: 'GET', url: '/users/' })

  expect(response.statusCode).toBe(200)
})
