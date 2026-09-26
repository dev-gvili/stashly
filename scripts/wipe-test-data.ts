/**
 * Removes @test.local fixture accounts and everything they own from the dev DB.
 *
 * Counterpart to the teardown fix in app/.server/__tests__/helpers/
 * wipe-test-users.ts. That stops new leaks; this clears what earlier runs left
 * behind, before the rollup triggers had a bypass.
 *
 * Dry-run by default — pass --commit to actually delete.
 *
 *   npx tsx --env-file=.env scripts/wipe-test-data.ts            # report only
 *   npx tsx --env-file=.env scripts/wipe-test-data.ts --commit   # delete
 *
 * Lives in the repo root because module resolution fails from a temp dir.
 */
import { prisma } from '@/services/db'
import { wipeTestUsers } from '@/services/__tests__/helpers/wipe-test-users'

const COMMIT = process.argv.includes('--commit')

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: '@test.local' } },
    select: { id: true, email: true },
  })

  // Belt and braces: the query above already scopes to @test.local, but this
  // script deletes accounts, so it re-checks rather than trusting the filter.
  const unexpected = users.filter((u) => !u.email.endsWith('@test.local'))
  if (unexpected.length > 0) {
    throw new Error(
      `ABORT: ${unexpected.length} non-test account(s) in scope, e.g. ${unexpected[0].email}`
    )
  }

  const ids = users.map((u) => u.id)
  const items = await prisma.item.count({ where: { ownerId: { in: ids } } })
  const drives = await prisma.drive.count({ where: { ownerId: { in: ids } } })
  const memberless = await prisma.workspace.count({ where: { members: { none: {} } } })

  console.log('scope')
  console.log('  @test.local users     :', ids.length)
  console.log('  items they own        :', items)
  console.log('  drives they own       :', drives)
  console.log('  member-less workspaces:', memberless)

  if (!COMMIT) {
    console.log('\nDRY RUN — nothing deleted. Re-run with --commit.')
    return
  }
  if (ids.length === 0 && memberless === 0) {
    console.log('\nNothing to do.')
    return
  }

  await prisma.permission.deleteMany({ where: { item: { ownerId: { in: ids } } } })
  // WorkspaceMember before Workspace: the FK is ON DELETE RESTRICT.
  await prisma.workspaceMember.deleteMany({ where: { memberId: { in: ids } } })
  await wipeTestUsers(ids)
  const removed = await prisma.workspace.deleteMany({ where: { members: { none: {} } } })

  console.log('\ndeleted member-less workspaces:', removed.count)
  console.log('remaining @test.local users   :',
    await prisma.user.count({ where: { email: { endsWith: '@test.local' } } }))
  console.log('COMMITTED')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
