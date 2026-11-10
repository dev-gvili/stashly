// Stop: remind the owner only when the working tree holds a significant change
// (new/changed routes, actions, schema) with no test or doc change beside it.
// Silent otherwise. Output is a user-visible systemMessage; it never blocks.
import { execFileSync } from 'node:child_process'

let files = []
try {
  const run = (args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean)
  files = [...run(['diff', '--name-only', 'HEAD']), ...run(['ls-files', '--others', '--exclude-standard'])]
} catch {
  process.exit(0)
}
files = [...new Set(files.map((f) => f.replace(/\\/g, '/')))]

const significant = files.filter((f) =>
  /^app\/routes\/.+\.tsx?$|^app\/routes\.ts$|^app\/\.server\/[^/]+-actions\.ts$|^prisma\/(?:models|migrations)\//.test(f),
)
if (significant.length === 0) process.exit(0)

const hasTests = files.some((f) => /\/__tests__\/|^tests\/e2e\//.test(f))
const hasDocs = files.some((f) => /^(?:CLAUDE\.md|README\.md|docs\/|\.claude\/skills\/)/.test(f))
const gaps = []
if (!hasTests) gaps.push('no test added or changed')
if (!hasDocs) gaps.push('no CLAUDE.md / README / docs / skill update')
if (gaps.length === 0) process.exit(0)

const list = significant.slice(0, 4).join(', ') + (significant.length > 4 ? ` +${significant.length - 4} more` : '')
process.stdout.write(
  JSON.stringify({
    systemMessage: `Significant change (${list}) with ${gaps.join(' and ')}. Skip for small tweaks; otherwise: tests, docs, then /ship (commit + push to main; a PR is the exception).`,
  }),
)
