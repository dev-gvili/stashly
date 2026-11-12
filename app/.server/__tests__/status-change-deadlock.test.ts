import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { prisma } from '@/services/db'
import { trashItems } from '@/services/item-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * Tech-debt item 93: a trash can deadlock (40P01) with the per-row size
 * cascade and with the rollup, because the three take the same rows in
 * different orders:
 *
 * - `trashItems` holds its folders' `Item` rows FOR UPDATE
 *   (`lockSubtreeFolders`), then its status update fires `item_status_change`,
 *   whose `stashly_apply_folder_deltas()` locks every affected folder's
 *   `Folder` row, then its `Item` row, each set in **id order**.
 * - The per-row cascade (`update_size()`, from a copy, move, delete or an idle
 *   upload) locks the ancestors' `Item` rows **bottom-up**. Ids are random, so
 *   along a chain id order runs top-down about half the time per pair.
 * - The rollup (`apply_item_size_deltas`) takes `Folder`, then `Item`.
 *
 * These tests force each interleaving with connections of their own and a
 * blocker, and run the real `trashItems` and the real triggers. Nothing is
 * mocked: what they measure is the migration as it stands.
 *
 * DEADLOCKS_TODAY records the current behaviour, so the file passes and CI
 * stays green while the fix waits for the owner (it needs a trigger change).
 * The fix flips it to `false`: then every case must finish with no deadlock,
 * and the file guards the new lock order from then on. A fix that doesn't
 * remove a deadlock fails here until it does.
 *
 * Each case rolls back its raw connections; a trash that wins commits on its
 * own test tree, which `afterAll` wipes. Every raw connection carries a
 * `lock_timeout` and an idle-in-transaction timeout, so a failed run can't
 * strand locks on a shared database (it once did, for about 10 minutes).
 * Needs a live database with migrations applied (CI provides one).
 */
const DEADLOCKS_TODAY = true

const uid = (model: Parameters<typeof getPrefixForModel>[0]) =>
  toObjectId(getPrefixForModel(model))
const url = () => process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let userId: string
let driveId: string

beforeAll(async () => {
  userId = uid('User')
  await prisma.user.create({
    data: {
      id: userId,
      name: 'Deadlock probe',
      email: `deadlock-${userId}@test.local`,
      emailVerified: true,
    },
  })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId: userId } })
  await prisma.quota.create({
    data: { id: uid('Quota'), driveId, total: 10n ** 12n },
  })
})

afterAll(async () => {
  await wipeTestUsers([userId])
  await prisma.user.deleteMany({ where: { id: userId } })
})

type Tree = {
  root: string
  a: string
  b: string
  c: string
  tf: string
  f1: string
  s: string
  g: string
}

async function makeItem(
  id: string,
  name: string,
  type: 'file' | 'folder',
  parentId: string | null,
  size = 0n
) {
  await prisma.item.create({
    data: {
      id,
      name,
      type,
      category: type === 'file' ? 'document' : 'unknown',
      status: 'normal',
      ownerId: userId,
      driveId,
      parentId,
      size,
      ...(type === 'folder'
        ? { folder: { create: { id: uid('Folder') } } }
        : {}),
    },
  })
}

/**
 * root → A → B → C → { TF → f1 (100 B), S → g (10 B) }. TF is trashed, S
 * takes a copied row. `topDown`: the ancestors' ids ascend from the root down,
 * the order that meets the cascade head-on; otherwise they descend.
 */
async function makeTree(order: 'topDown' | 'bottomUp'): Promise<Tree> {
  const tag = `${uid('Item')}_`
  const [root, a, b, c] = (
    order === 'topDown' ? ['a', 'b', 'c', 'd'] : ['d', 'c', 'b', 'a']
  ).map((l) => tag + l)
  const t: Tree = {
    root,
    a,
    b,
    c,
    tf: `${tag}xtf`,
    f1: `${tag}xf1`,
    s: `${tag}xs`,
    g: `${tag}xg`,
  }
  await makeItem(t.root, 'root', 'folder', null)
  await makeItem(t.a, 'A', 'folder', t.root)
  await makeItem(t.b, 'B', 'folder', t.a)
  await makeItem(t.c, 'C', 'folder', t.b)
  await makeItem(t.tf, 'TF', 'folder', t.c)
  await makeItem(t.f1, 'f1', 'file', t.tf, 100n)
  await makeItem(t.s, 'S', 'folder', t.c)
  await makeItem(t.g, 'g', 'file', t.s, 10n)
  return t
}

type Client = pg.Client & { pid: number }

async function connect(): Promise<Client> {
  const c = new pg.Client({ connectionString: url() })
  await c.connect()
  // Above deadlock_timeout (1 s by default), so the deadlock check fires first.
  await c.query(
    `SET lock_timeout = '10s'; SET idle_in_transaction_session_timeout = '20s'`
  )
  const { rows } = await c.query('SELECT pg_backend_pid() AS pid')
  return Object.assign(c, { pid: rows[0].pid as number })
}

let probe: Client
beforeAll(async () => {
  probe = await connect()
})
afterAll(async () => {
  await probe.end()
})

/** Waits until a backend that `matches` waits on a lock; returns its pid. */
async function untilWaiting(matches: string, args: unknown[]) {
  for (let i = 0; i < 400; i++) {
    const { rows } = await probe.query(
      `SELECT pid FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND (${matches}) LIMIT 1`,
      args
    )
    if (rows[0]) return rows[0].pid as number
    await sleep(25)
  }
  throw new Error(`no backend matching ${matches} waited on a lock`)
}

type Outcome = { ok: true } | { ok: false; code: string }

/** A deadlock victim's code, read from a pg error or Prisma's raw-query error text. */
function outcomeOf(error: unknown): Outcome {
  const e = error as { code?: string; message?: string }
  // Prisma wraps the driver's error as P2010 and names the SQLSTATE in its text.
  if (/40P01|deadlock detected/.test(String(e?.message ?? e)))
    return { ok: false, code: '40P01' }
  return { ok: false, code: String(e?.code ?? e?.message ?? e) }
}

/** Waits for one side and rolls its transaction back, so the other can't wait on it forever. */
const settle = (p: Promise<unknown>, rollback?: Client): Promise<Outcome> =>
  p
    .then(
      () => ({ ok: true }) as Outcome,
      (e) => outcomeOf(e)
    )
    .then(async (o) => {
      await rollback?.query('ROLLBACK').catch(() => {})
      return o
    })

/** A copy's write: a sized row inserted with no uploadId, so update_size() cascades at once. */
const COPY_ROW_SQL = `
  INSERT INTO "Item"
  SELECT (jsonb_populate_record(NULL::"Item", to_jsonb(i) || jsonb_build_object('id', $1::text))).*
  FROM "Item" i WHERE i."id" = $2`

/**
 * A: X holds B (as a long copy, move or another trash would). W inserts a row
 * into S: its cascade locks S, C, then waits on B. The trash then locks its
 * folders in id order and, when the ids run top-down, takes root and A and
 * waits on B too. X commits, W gets B and wants A, which the trash holds.
 */
async function trashAgainstCascade(order: 'topDown' | 'bottomUp') {
  const t = await makeTree(order)
  const [x, w] = await Promise.all([connect(), connect()])
  try {
    await x.query('BEGIN')
    await x.query(`SELECT 1 FROM "Item" WHERE "id" = $1 FOR NO KEY UPDATE`, [
      t.b,
    ])
    await w.query('BEGIN')
    const writer = settle(w.query(COPY_ROW_SQL, [`${t.g}_copy`, t.g]), w)
    await untilWaiting('pid = $1 AND $2 = ANY(pg_blocking_pids(pid))', [
      w.pid,
      x.pid,
    ])
    const trash = settle(trashItems([t.tf], userId))
    // The trash waits on X (ids top-down) or on W (bottom-up).
    await untilWaiting(
      `pg_blocking_pids(pid) && $1::int[] AND query ILIKE '%SET "status" = ''trashed''%'`,
      [[x.pid, w.pid]]
    )
    await x.query('COMMIT')
    const [writerOutcome, trashOutcome] = await Promise.all([writer, trash])
    return { writer: writerOutcome, trash: trashOutcome }
  } finally {
    for (const c of [w, x]) await c.query('ROLLBACK').catch(() => {})
    await Promise.all([x.end(), w.end()])
  }
}

/**
 * B: K holds the file f1 FOR SHARE, which a status update must wait for and
 * `lockSubtreeFolders` (folders only) doesn't touch. So the trash holds TF's
 * `Item` row and stops between its two statements, on f1. The rollup, applying
 * a delta for TF (an upload logged while the database was busy), takes TF's
 * `Folder` row and waits for the `Item` row. K lets go: the trash's trigger
 * wants `Folder`, held by the rollup, which wants `Item`, held by the trash.
 */
async function trashAgainstRollup(order: 'topDown' | 'bottomUp') {
  const t = await makeTree(order)
  const [k, r] = await Promise.all([connect(), connect()])
  try {
    await k.query('BEGIN')
    await k.query(`SELECT 1 FROM "Item" WHERE "id" = $1 FOR SHARE`, [t.f1])
    const trash = settle(trashItems([t.tf], userId))
    const trashPid = await untilWaiting(
      `$1 = ANY(pg_blocking_pids(pid)) AND query ILIKE '%SET "status" = ''trashed''%'`,
      [k.pid]
    )
    await r.query('BEGIN')
    await r.query(
      `INSERT INTO "ItemSizeDelta" ("parentId", "active", "inclusive", "children") VALUES ($1, 5, 5, 1)`,
      [t.tf]
    )
    const rollup = settle(
      r.query(`SELECT apply_item_size_deltas(5000, true)`),
      r
    )
    // On the trash itself, not on the rollup's advisory lock another test file may hold.
    await untilWaiting('pid = $1 AND $2 = ANY(pg_blocking_pids(pid))', [
      r.pid,
      trashPid,
    ])
    await k.query('ROLLBACK')
    const [rollupOutcome, trashOutcome] = await Promise.all([rollup, trash])
    return { rollup: rollupOutcome, trash: trashOutcome }
  } finally {
    for (const c of [r, k]) await c.query('ROLLBACK').catch(() => {})
    await Promise.all([k.end(), r.end()])
  }
}

const deadlocked = (outcomes: Outcome[]) =>
  outcomes.filter((o) => !o.ok && o.code === '40P01').length
const CASE_TIMEOUT_MS = 30_000

describe('item 93: a trash against the per-row size cascade', () => {
  it(
    DEADLOCKS_TODAY
      ? 'deadlocks when the shared ancestors ids run top-down and a third transaction holds one'
      : 'finishes both sides when the shared ancestors ids run top-down',
    { timeout: CASE_TIMEOUT_MS },
    async () => {
      const { writer, trash } = await trashAgainstCascade('topDown')
      if (DEADLOCKS_TODAY) {
        // Exactly one side is cancelled; the other finishes.
        expect(deadlocked([writer, trash])).toBe(1)
        expect([writer, trash].filter((o) => o.ok)).toHaveLength(1)
      } else {
        expect({ writer, trash }).toEqual({
          writer: { ok: true },
          trash: { ok: true },
        })
      }
    }
  )

  it(
    'finishes both sides when the ids run bottom-up, the cascade own order',
    { timeout: CASE_TIMEOUT_MS },
    async () => {
      expect(await trashAgainstCascade('bottomUp')).toEqual({
        writer: { ok: true },
        trash: { ok: true },
      })
    }
  )
})

describe('item 93: a trash against the rollup', () => {
  for (const order of ['topDown', 'bottomUp'] as const) {
    it(
      DEADLOCKS_TODAY
        ? `deadlocks when the rollup takes the trashed folder's Folder row between the trash's two statements (${order})`
        : `finishes both sides when the rollup meets a trash (${order})`,
      { timeout: CASE_TIMEOUT_MS },
      async () => {
        const { rollup, trash } = await trashAgainstRollup(order)
        if (DEADLOCKS_TODAY) {
          expect(deadlocked([rollup, trash])).toBe(1)
          expect([rollup, trash].filter((o) => o.ok)).toHaveLength(1)
        } else {
          expect({ rollup, trash }).toEqual({
            rollup: { ok: true },
            trash: { ok: true },
          })
        }
      }
    )
  }
})
