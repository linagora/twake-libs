import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export interface CommitHookLog {
  error: (object: object, message: string) => void
}

export type Db = ReturnType<typeof drizzle<Record<string, never>, postgres.Sql>>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type Transaction = Db['transaction']
type Hook = () => unknown

const commitHooks = new WeakMap<Tx, Hook[]>()

// Drizzle has no commit hook. A savepoint hands its hooks to its transaction
// once it is released, so one that rolls back alone drops them. A hook that
// throws or rejects is only logged, since its transaction has committed.
function runHooksOnCommit(
  target: { transaction: Transaction },
  log: CommitHookLog,
  outer?: Hook[]
): void {
  const transaction = target.transaction.bind(target)
  target.transaction = (async (
    body: (tx: Tx) => Promise<unknown>,
    config?: Parameters<Transaction>[1]
  ) => {
    const hooks: Hook[] = []
    const result = await transaction(tx => {
      commitHooks.set(tx, hooks)
      runHooksOnCommit(tx, log, hooks)
      return body(tx)
    }, config)
    if (outer) outer.push(...hooks)
    else {
      const failed = (error: unknown): void =>
        log.error({ err: error }, 'a commit hook failed')
      for (const hook of hooks) {
        try {
          void Promise.resolve(hook()).catch(failed)
        } catch (error) {
          failed(error)
        }
      }
    }
    return result
  }) as Transaction
}

export function createDb(
  url: string,
  options: { log?: CommitHookLog; poolMax?: number } = {}
): { sql: postgres.Sql; db: Db } {
  const sql = postgres(url, {
    onnotice: () => undefined,
    ...(options.poolMax !== undefined && { max: options.poolMax })
  })
  const db = drizzle({ client: sql })
  runHooksOnCommit(db, options.log ?? console)
  return { sql, db }
}

/** Runs `hook` once the transaction commits, and never if it rolls back. */
export function afterCommit(tx: Tx, hook: Hook): void {
  const hooks = commitHooks.get(tx)
  if (!hooks) throw new Error('not in a transaction of a createDb database')
  hooks.push(hook)
}

// Socket errors from Node, and postgres.js's own connection errors.
const CONNECTION_ERRORS = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED'
])

// Connection exceptions, insufficient resources, server shutting down,
// serialization failures and deadlocks, lock and statement timeouts.
const TRANSIENT_SQLSTATE =
  /^(08(?!P01)|53|57P0[1235]$|40001$|40P01$|55P03$|57014$)/

/** Whether the work may succeed if tried again later, unchanged. */
export function isTransient(error: unknown): boolean {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    const code = (cause as { code?: unknown }).code
    if (typeof code !== 'string') continue
    if (CONNECTION_ERRORS.has(code)) return true
    if (cause.name === 'PostgresError') return TRANSIENT_SQLSTATE.test(code)
  }
  return false
}

// Postgres has uuidv7() built in only from 18. Older servers get the same ids
// from this function: the millisecond time, then the random bits of a v4, with
// the version set to 7.
const UUIDV7 = `
  create or replace function uuidv7() returns uuid language sql volatile as $$
    select encode(
      set_bit(set_bit(
        overlay(uuid_send(gen_random_uuid())
          placing substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6),
        52, 1), 53, 1), 'hex')::uuid
  $$`

// The drizzle migrator takes no lock: replicas starting together would apply
// the same migration. A reserved connection holds the session lock while the
// pool migrates, since drizzle cannot run on a reserved connection.
export async function migrateDb(
  sql: postgres.Sql,
  migrationsFolder: string
): Promise<void> {
  if (sql.options.max < 2) {
    throw new Error('migrateDb needs a pool of at least 2 connections')
  }
  const connection = await sql.reserve()
  try {
    await connection`select pg_advisory_lock(hashtext('migrations'))`
    try {
      const [server] = await connection<{ version: number }[]>`
        select current_setting('server_version_num')::int as version`
      if (!server || server.version < 180000) await connection.unsafe(UUIDV7)
      await migrate(drizzle({ client: sql }), { migrationsFolder })
    } finally {
      await connection`select pg_advisory_unlock(hashtext('migrations'))`
    }
  } finally {
    connection.release()
  }
}
