import { fileURLToPath } from 'node:url'

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer
} from '@testcontainers/postgresql'
import { sql as statement } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  afterCommit,
  createDb,
  isTransient,
  migrateDb,
  type Db
} from './postgres.js'

const MIGRATIONS = fileURLToPath(new URL('../test/migrations', import.meta.url))

let container: StartedPostgreSqlContainer
let sql: postgres.Sql
let db: Db
const log = { error: vi.fn() }

beforeAll(async () => {
  // 17 rather than 18, so migrateDb has to bring its own uuidv7().
  container = await new PostgreSqlContainer('postgres:17').start()
  ;({ sql, db } = createDb(container.getConnectionUri(), { log }))
}, 120_000)

afterAll(async () => {
  await sql.end()
  await container.stop()
})

describe('migrateDb', () => {
  it('applies each migration once when replicas start together', async () => {
    const replicas = [0, 1, 2].map(() => createDb(container.getConnectionUri()))

    await Promise.all(replicas.map(r => migrateDb(r.sql, MIGRATIONS)))
    await Promise.all(replicas.map(r => r.sql.end()))

    const rows = await sql<{ id: string }[]>`
      insert into notes (body) values ('hello') returning id`
    expect(rows[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)
  })

  it('refuses a pool too small to hold the lock and migrate', async () => {
    const single = createDb(container.getConnectionUri(), { poolMax: 1 })

    await expect(migrateDb(single.sql, MIGRATIONS)).rejects.toThrow(
      'at least 2 connections'
    )
    await single.sql.end()
  })
})

describe('afterCommit', () => {
  it('runs once the transaction commits', async () => {
    const hook = vi.fn()

    await db.transaction(async tx => {
      afterCommit(tx, hook)
      await tx.execute(statement`select 1`)
      expect(hook).not.toHaveBeenCalled()
    })

    expect(hook).toHaveBeenCalledOnce()
  })

  it('never runs when the transaction rolls back', async () => {
    const hook = vi.fn()

    await expect(
      db.transaction(tx => {
        afterCommit(tx, hook)
        return Promise.reject(new Error('refused'))
      })
    ).rejects.toThrow('refused')

    expect(hook).not.toHaveBeenCalled()
  })

  it('waits for the outer transaction from a savepoint', async () => {
    const order: string[] = []

    await db.transaction(async tx => {
      await tx.transaction(inner => {
        afterCommit(inner, () => order.push('hook'))
        return Promise.resolve()
      })
      order.push('outer body')
    })

    expect(order).toEqual(['outer body', 'hook'])
  })

  it('drops the hooks of a savepoint that rolls back alone', async () => {
    const dropped = vi.fn()
    const kept = vi.fn()

    await db.transaction(async tx => {
      afterCommit(tx, kept)
      await tx
        .transaction(inner => {
          afterCommit(inner, dropped)
          return Promise.reject(new Error('refused'))
        })
        .catch(() => undefined)
    })

    expect(dropped).not.toHaveBeenCalled()
    expect(kept).toHaveBeenCalledOnce()
  })

  it('logs a hook that throws and runs the others', async () => {
    const next = vi.fn()

    await db.transaction(tx => {
      afterCommit(tx, () => {
        throw new Error('mail gone')
      })
      afterCommit(tx, next)
      return Promise.resolve()
    })

    expect(next).toHaveBeenCalledOnce()
    expect(log.error).toHaveBeenCalledWith(
      { err: new Error('mail gone') },
      'a commit hook failed'
    )
  })

  it('logs a hook that rejects', async () => {
    await db.transaction(tx => {
      afterCommit(tx, () => Promise.reject(new Error('queue gone')))
      return Promise.resolve()
    })

    await vi.waitFor(() =>
      expect(log.error).toHaveBeenCalledWith(
        { err: new Error('queue gone') },
        'a commit hook failed'
      )
    )
  })
})

describe('isTransient', () => {
  it('holds for a server that cannot be reached', async () => {
    const unreachable = postgres('postgres://nobody@127.0.0.1:1/none', {
      connect_timeout: 1
    })

    const error = await unreachable`select 1`.catch((e: unknown) => e)
    await unreachable.end()

    expect(isTransient(error)).toBe(true)
  })

  it('holds for a serialization failure, even as a cause', async () => {
    const error = await sql`
      do $$ begin raise exception 'conflict' using errcode = '40001'; end $$`.catch(
      (e: unknown) => e
    )

    expect(isTransient(new Error('wrapped', { cause: error }))).toBe(true)
  })

  it('does not hold for a constraint violation', async () => {
    const error = await sql`insert into notes (body) values (null)`.catch(
      (e: unknown) => e
    )

    expect(isTransient(error)).toBe(false)
  })

  it('does not hold for an error with no code', () => {
    expect(isTransient(new Error('bug'))).toBe(false)
  })
})
