// PostToolUse (Edit|Write|MultiEdit): after a Prisma schema edit, hand Claude
// the checklist CLAUDE.md → Migrations requires.
import { readFileSync } from 'node:fs'

let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {
  process.exit(0)
}
const file = String(input.tool_input?.file_path ?? '').replace(/\\/g, '/')
if (!/(?:^|\/)prisma\/models\/[^/]+\.prisma$/.test(file)) process.exit(0)

const context = [
  `Prisma schema edited (${file.split('/').pop()}). CLAUDE.md → Migrations requires, in this order:`,
  '1. Write the migration (a comment-only migration.sql when `prisma migrate diff` is empty, including a relation rename).',
  '2. Run `pnpm prisma generate` (app/prisma is generated, not tracked).',
  '3. Do NOT run `pnpm prisma migrate dev` unless the owner asked; hand it over.',
  '4. Close with the list the owner must still run: `pnpm prisma migrate dev`, a dev-server restart (the running server caches the old client and throws `Unknown argument`), and any re-index.',
  'Schema files and migrations need owner approval before editing; if this edit had none, stop and say so.',
].join('\n')

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context } }),
)
