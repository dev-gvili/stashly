/**
 * Commit-time scoped typecheck (PreToolUse hook, wired in .claude/settings.json).
 *
 * Runs the repo's full typecheck (react-router typegen + tsc -b, incremental
 * so ~8s warm) but only *gates* on the staged .ts/.tsx files: a file blocks
 * the commit when its current error count exceeds its count in
 * .claude/tsc-baseline.json. The repo carries a handful of pre-existing errors,
 * so a plain "no errors in staged files" check would wrongly block unrelated
 * edits to already-broken files — the baseline makes the gate ratchet-only.
 *
 * Regenerate the baseline after intentionally fixing/accepting errors:
 *   node .claude/hooks/check-staged-types.mjs --update-baseline
 *
 * CI gates the whole repo instead of the staged files, and also fails when the
 * baseline has slack (a fixed error not yet removed from it):
 *   node .claude/hooks/check-staged-types.mjs --all
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const BASELINE_PATH = '.claude/tsc-baseline.json'
const updateBaseline = process.argv.includes('--update-baseline')
const checkAll = process.argv.includes('--all')

function run(cmd, args) {
  try {
    const out = execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32', // pnpm/git resolve via .cmd shims
    })
    return { out, code: 0 }
  } catch (e) {
    return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, code: e.status ?? 1 }
  }
}

const staged = run('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
  .out.split('\n')
  .map((s) => s.trim())
  .filter((f) => /\.(ts|tsx)$/.test(f))

if (!updateBaseline && !checkAll && staged.length === 0) process.exit(0)

run('pnpm', ['exec', 'react-router', 'typegen'])
const tsc = run('pnpm', ['exec', 'tsc', '-b', '--pretty', 'false'])

// Per-file error tally from `file(line,col): error TSxxxx: ...` diagnostics.
const counts = new Map()
const errorLines = new Map()
for (const line of tsc.out.split(/\r?\n/)) {
  const m = line.match(/^(.+?)\(\d+,\d+\): error TS/)
  if (!m) continue
  const file = m[1].replace(/\\/g, '/')
  counts.set(file, (counts.get(file) ?? 0) + 1)
  if (!errorLines.has(file)) errorLines.set(file, [])
  errorLines.get(file).push(line)
}

// tsc failed without a single parseable diagnostic (missing binary, crashed
// config): nothing was checked, so an empty tally must not read as clean.
if (tsc.code !== 0 && counts.size === 0) {
  console.error('BLOCK: tsc failed without reporting any diagnostics:')
  console.error(tsc.out)
  process.exit(2)
}

if (updateBaseline) {
  const sorted = Object.fromEntries(
    [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  )
  writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n')
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  console.log(`baseline written: ${total} error(s) across ${counts.size} file(s) -> ${BASELINE_PATH}`)
  process.exit(0)
}

let baseline = {}
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
} catch {
  console.error(`warning: ${BASELINE_PATH} missing/unreadable — treating all baselines as 0`)
}

// Only a file that has errors now can exceed its baseline, so --all needs
// just the files tsc reported.
const checked = checkAll ? [...counts.keys()] : staged

const regressions = checked
  .map((f) => ({ f, cur: counts.get(f) ?? 0, base: baseline[f] ?? 0 }))
  .filter((r) => r.cur > r.base)

if (regressions.length > 0) {
  console.error(
    `BLOCK: new type errors in ${checkAll ? 'the repo' : 'staged files'} (count exceeds baseline):`
  )
  for (const r of regressions) {
    console.error(`\n${r.f}: ${r.cur} error(s), baseline ${r.base}`)
    for (const l of errorLines.get(r.f) ?? []) console.error(`  ${l}`)
  }
  console.error(
    '\nFix the errors, or if the baseline is stale run: node .claude/hooks/check-staged-types.mjs --update-baseline'
  )
  process.exit(2)
}

// In --all mode a baseline entry above the current count is slack: a fixed
// error the baseline would let back in. Failing on it keeps the ratchet tight —
// the commit that fixes errors has to lower the baseline with them. Entries for
// deleted files count too, since they report zero.
if (checkAll) {
  const slack = Object.keys(baseline).filter((f) => (counts.get(f) ?? 0) < baseline[f])
  if (slack.length > 0) {
    console.error('BLOCK: the baseline allows more errors than tsc reports:')
    for (const f of slack) console.error(`  ${f}: baseline ${baseline[f]}, now ${counts.get(f) ?? 0}`)
    console.error(
      '\nLock the improvement in: node .claude/hooks/check-staged-types.mjs --update-baseline'
    )
    process.exit(2)
  }
}

const improved = checked.filter((f) => (counts.get(f) ?? 0) < (baseline[f] ?? 0))
if (improved.length > 0) {
  console.log(
    `type errors reduced in: ${improved.join(', ')} — consider refreshing the baseline`
  )
}
process.exit(0)
