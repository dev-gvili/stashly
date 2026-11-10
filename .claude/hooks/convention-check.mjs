// PostToolUse (Edit|Write|MultiEdit): flag Stashly convention violations in the
// text that was just written. Cheap regex, not a lint run. Exit 2 = tell Claude.
import { readFileSync } from 'node:fs'

let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {
  process.exit(0)
}
const ti = input.tool_input ?? {}
const file = String(ti.file_path ?? '').replace(/\\/g, '/')
const rel = file.match(/(?:^|\/)(app\/.+\.(?:ts|tsx))$/)?.[1]
if (!rel) process.exit(0)

const text =
  ti.content ??
  ti.new_string ??
  (Array.isArray(ti.edits) ? ti.edits.map((e) => e.new_string ?? '').join('\n') : '')
if (!text) process.exit(0)

const isTest = /\/__tests__\//.test(rel)
const isTsx = rel.endsWith('.tsx')
const base = rel.split('/').pop() ?? ''
const problems = []

if (/from\s+['"](?:sonner|@\/components\/ui\/sonner)['"]/.test(text)) {
  problems.push('sonner/toast is banned (owner decision, 8 Nov). Use the existing in-app feedback pattern.')
}
if (rel.startsWith('app/.server/') && !isTest && !/^log\b/.test(base) && /\bconsole\.(log|warn|error|info|debug)\b/.test(text)) {
  problems.push("console.* in app/.server: use `log` from '@/services/log' (fixed message, identifiers as fields).")
}
if (isTsx && /\bfont-(?:sans|mono|serif)\b/.test(text)) {
  problems.push('Raw font class: use `font-stashly` and the Stashly type scale.')
}
if (/\btext-\[\d+(?:\.\d+)?(?:px|rem|em)\]/.test(text)) {
  problems.push('Arbitrary text size: use the type scale (`text-xs` is the smallest, e.g. `text-sm` not `text-[10px]`).')
}
if (/^app\/(?:components|hooks|machines|\.client|workers|utils)\//.test(rel) && !isTest && /from\s+['"]@\/(?:services|\.server)\//.test(text)) {
  problems.push('Client-bundled file imports server code (`@/services/*` or `@/.server/*`): the production build rejects this. Move it behind a loader/action.')
}
if (rel.startsWith('app/routes/') && !isTest && /from\s+['"]@\/services\/db['"]/.test(text)) {
  problems.push('Routes never call prisma directly: put the query in an `app/.server/*-actions.ts` function.')
}
if (/^app\/routes\/api\//.test(rel) && !isTest && /\bgetSession\s*\(/.test(text)) {
  problems.push('API routes read `context.get(sessionContext)`, never `getSession` (it drops the refreshed cache cookie).')
}

if (problems.length) {
  console.error(`Convention check on ${rel}:\n- ${problems.join('\n- ')}`)
  process.exit(2)
}
