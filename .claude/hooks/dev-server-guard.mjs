// PreToolUse (Bash|PowerShell): the dev server on port 80 is the owner's.
// Never kill/restart it, and never start a second one. Exit 2 = refuse.
// A user-invoked skill that must kill it (devstop) marks its command with
// the comment `allow-dev-kill`.
import { readFileSync } from 'node:fs'
import net from 'node:net'

let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {
  process.exit(0)
}
const cmd = String(input.tool_input?.command ?? '')
if (!cmd || /allow-dev-kill/.test(cmd)) process.exit(0)

const killer = /\b(?:taskkill|Stop-Process|pkill|killall|kill)\b|\bxargs\s+kill\b/i
const target = /\bnode(?:\.exe)?\b|\bpnpm\b|\bvite\b|\btsx\b|:80\b|LocalPort\s*(?:=|\s)\s*80\b|-Port\s*80\b|\/PID\b/i
if (killer.test(cmd) && target.test(cmd)) {
  console.error(
    'BLOCKED: the dev server on port 80 is managed by the owner. Never kill or restart it; if a change needs a restart, say so and wait.',
  )
  process.exit(2)
}

if (/\b(?:pnpm|npm|yarn)\s+(?:run\s+)?dev\b/.test(cmd)) {
  const listening = await new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port: 80 })
    const done = (v) => {
      s.destroy()
      resolve(v)
    }
    s.setTimeout(500, () => done(false))
    s.once('connect', () => done(true))
    s.once('error', () => done(false))
  })
  if (listening) {
    console.error('BLOCKED: a server is already listening on port 80. Use it; do not start a second dev server.')
    process.exit(2)
  }
}
