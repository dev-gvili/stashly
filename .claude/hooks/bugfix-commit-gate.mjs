// PreToolUse (Bash|PowerShell): in a session that ran the stashly-bug-fixer
// skill, a commit that stages code needs proof the bug was reproduced and fixed:
//   1. a test file in the commit (or committed earlier this session) that ran
//      RED in this session and GREEN in a later run, and
//   2. a real-service probe log: .claude/evidence/bugfix/<slug>/probe-before.*
//      and probe-after.*, both written this session, before older than after.
// Other sessions, and commits staging only docs/config, pass untouched.
// Exit 2 = refuse, with the missing pieces on stderr.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SKILL = 'stashly-bug-fixer'
const CODE = /^(app|server|prisma|tests)(\/|$)/
const TEST_FILE = /\.(test|spec)\.tsx?$/
const TEST_PATH = /[\w@./-]+\.(?:test|spec)\.tsx?/g
const TEST_RUN = /\b(?:vitest|playwright\s+test|(?:pnpm|npm)\s+(?:run\s+)?test(?::e2e)?)\b/

let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {
  process.exit(0)
}
const cmd = String(input.tool_input?.command ?? '')
if (!/\bgit\b(?:\s+-\S+(?:\s+\S+)?)*\s+commit\b/.test(cmd)) process.exit(0)

const transcript = readTranscript(input.transcript_path)
if (!transcript.length || !skillRan(transcript)) process.exit(0)

const dashC = cmd.match(/\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/)?.[1]?.replace(/^["']|["']$/g, '')
const cwd = dashC ? resolve(input.cwd || process.cwd(), dashC) : input.cwd || process.cwd()
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return ''
  }
}
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean)

// The hook runs before the command, so `git add x && git commit` and
// `git commit -a` have not staged their files yet: count those too.
const staged = new Set(lines(git('diff', '--cached', '--name-only')))
for (const m of cmd.matchAll(/\bgit\s+(?:-C\s+\S+\s+)?add\s+([^|;&\n]*)/g)) {
  const args = m[1].trim().split(/\s+/).filter(Boolean)
  const paths = args.filter((a) => !a.startsWith('-')).map((a) => a.replace(/^["']|["']$/g, ''))
  if (args.some((a) => a === '-A' || a === '--all') || paths.some((p) => p === '.' || p === '*'))
    for (const l of lines(git('status', '--porcelain'))) staged.add(l.slice(3).replace(/^.* -> /, ''))
  else for (const p of paths) staged.add(p)
}
if (/\bcommit\b(?:\s+\S+)*?\s(?:-[a-zA-Z]*a[a-zA-Z]*|--all)\b/.test(cmd))
  for (const f of lines(git('diff', '--name-only'))) staged.add(f)
const stagedFiles = [...staged].map((f) => f.replace(/\\/g, '/').replace(/^\.\//, ''))
if (!stagedFiles.some((f) => CODE.test(f))) process.exit(0)

const started = sessionStart(transcript)
const sessionTests = new Set(stagedFiles.filter((f) => TEST_FILE.test(f)))
if (started) {
  for (const f of lines(git('log', `--since=${new Date(started).toISOString()}`, '--name-only', '--format=')))
    if (TEST_FILE.test(f)) sessionTests.add(f)
}

const runs = testRuns(transcript)
const proven = [...sessionTests].filter((file) => {
  const red = runs.findIndex((r) => r.verdict === 'failed' && r.ids.some((id) => matches(file, id)))
  return red !== -1 && runs.slice(red + 1).some((r) => r.verdict === 'passed' && r.ids.some((id) => matches(file, id)))
})

const probe = probeLog(join(cwd, '.claude/evidence/bugfix'), started)

const missing = []
if (!proven.length) {
  missing.push(
    sessionTests.size
      ? `no red-then-green run for the session's test files (${[...sessionTests].join(', ')}). Run the test so it fails on the unfixed code, fix, then run it again green — name the file in both commands.`
      : 'no test file in this commit or in a commit made this session. Add the failing test that encodes the root cause and stage it with the fix.',
  )
}
if (!probe.ok) missing.push(probe.reason)

if (missing.length) {
  console.error(
    `BLOCKED (stashly-bug-fixer gate): this commit stages code, but the session lacks:\n- ${missing.join('\n- ')}\nA claim of "fixed" needs a red→green test and a before/after probe of the real service.`,
  )
  process.exit(2)
}
process.exit(0)

function readTranscript(path) {
  if (!path || !existsSync(path)) return []
  const out = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line) continue
    try {
      out.push(JSON.parse(line))
    } catch {}
  }
  return out
}

function blocks(entry, type) {
  const c = entry.message?.content
  if (typeof c === 'string') return type === 'text' ? [{ type: 'text', text: c }] : []
  return Array.isArray(c) ? c.filter((b) => b?.type === type) : []
}

function resultText(b) {
  if (typeof b.content === 'string') return b.content
  if (Array.isArray(b.content)) return b.content.map((c) => c?.text ?? '').join('\n')
  return ''
}

// Ran = the model called the Skill tool with it, or the user typed its slash command.
function skillRan(entries) {
  const name = new RegExp(`(?:^|:)${SKILL}$`, 'i')
  return entries.some((e) => {
    if (e.type === 'assistant')
      return blocks(e, 'tool_use').some((b) => b.name === 'Skill' && name.test(String(b.input?.skill ?? '')))
    if (e.type === 'user')
      return blocks(e, 'text').some((b) =>
        new RegExp(`<command-name>/?(?:[\\w-]+:)?${SKILL}</command-name>`, 'i').test(String(b.text ?? '')),
      )
    return false
  })
}

function sessionStart(entries) {
  const t = entries.find((e) => e.timestamp)?.timestamp
  return t ? Date.parse(t) : 0
}

// Each test-runner shell call with its verdict (from the runner's own summary,
// not the exit code — a pipe to tail hides that) and the tests it names.
function testRuns(entries) {
  const uses = new Map()
  const runs = []
  for (const e of entries) {
    if (e.type === 'assistant')
      for (const b of blocks(e, 'tool_use'))
        if ((b.name === 'Bash' || b.name === 'PowerShell') && TEST_RUN.test(String(b.input?.command ?? '')))
          uses.set(b.id, String(b.input.command))
    if (e.type === 'user')
      for (const b of blocks(e, 'tool_result')) {
        const command = uses.get(b.tool_use_id)
        if (command === undefined) continue
        const text = resultText(b)
        const verdict = /\b\d+ failed\b/.test(text)
          ? 'failed'
          : /(?:Tests?\s+\d+ passed|^\s*\d+ passed\b)/m.test(text)
            ? 'passed'
            : 'unknown'
        const failedIds = [...text.matchAll(/(?:FAIL|❯|×|✘)\s+(?:\d+\s+)?(?:\[[^\]]+\]\s+›\s+)?([\w@./-]+\.(?:test|spec)\.tsx?)/g)].map((m) => m[1])
        const ids =
          verdict === 'failed' && failedIds.length
            ? failedIds
            : [...(command.match(TEST_PATH) ?? []), ...(text.match(TEST_PATH) ?? []), ...nameFragments(command)]
        runs.push({ verdict, ids })
      }
  }
  return runs
}

// `pnpm test items-invalid-input` filters by a file-name fragment.
function nameFragments(command) {
  const m = command.match(/\b(?:pnpm|npm)\s+(?:run\s+)?test(?::e2e)?\s+([^|;&\n]*)/)
  if (!m) return []
  const out = []
  const tokens = m[1].trim().split(/\s+/)
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (/^-t$|^--testNamePattern$/.test(t)) i++
    else if (t && !t.startsWith('-') && !/^\d?>/.test(t) && /^[\w@./-]+$/.test(t)) out.push(t)
  }
  return out
}

function matches(file, id) {
  const f = file.replace(/\\/g, '/')
  const i = id.replace(/\\/g, '/').replace(/^\.\//, '')
  return TEST_FILE.test(i) ? f.endsWith(i) || i.endsWith(f) : f.includes(i)
}

function probeLog(root, since) {
  const where = '.claude/evidence/bugfix/<slug>/probe-before.* and probe-after.*'
  if (!existsSync(root)) return { ok: false, reason: `no real-service probe log (${where}).` }
  let stale = false
  for (const slug of readdirSync(root)) {
    const dir = join(root, slug)
    let names
    try {
      names = readdirSync(dir)
    } catch {
      continue
    }
    const pick = (prefix) =>
      names
        .filter((n) => n.startsWith(prefix))
        .map((n) => statSync(join(dir, n)))
        .filter((s) => s.isFile() && s.size > 0)
        .map((s) => s.mtimeMs)
    const before = pick('probe-before')
    const after = pick('probe-after')
    if (!before.length || !after.length) continue
    const b = Math.min(...before.filter((t) => t >= since))
    const a = Math.max(...after.filter((t) => t >= since))
    if (Number.isFinite(b) && Number.isFinite(a) && b < a) return { ok: true }
    stale = true
  }
  return {
    ok: false,
    reason: stale
      ? `the probe log (${where}) was not written this session, or probe-after is not newer than probe-before.`
      : `no real-service probe log (${where}), both non-empty.`,
  }
}
