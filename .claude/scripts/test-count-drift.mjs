// Compares the real Vitest totals with the figure recorded in CLAUDE.md
// ("`pnpm test` is **N tests in M files**"). Run manually or from CI; exit 1 on drift.
//   node .claude/scripts/test-count-drift.mjs            runs `pnpm test --reporter=json`
//   node .claude/scripts/test-count-drift.mjs result.json  reads an existing Vitest JSON report
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const claude = readFileSync('CLAUDE.md', 'utf8')
const m = claude.match(/`pnpm test` is \*\*(\d+) tests in (\d+) files\*\*/)
if (!m) {
  console.error('CLAUDE.md has no "`pnpm test` is **N tests in M files**" line to compare against')
  process.exit(2)
}
const [documentedTests, documentedFiles] = [Number(m[1]), Number(m[2])]

let report
const arg = process.argv[2]
if (arg) {
  report = JSON.parse(readFileSync(arg, 'utf8'))
} else {
  const out = execFileSync('pnpm', ['test', '--reporter=json'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    shell: true,
  })
  report = JSON.parse(out.slice(out.indexOf('{')))
}
const tests = report.numTotalTests
const files = report.testResults?.length ?? report.numTotalTestSuites
console.log(`CLAUDE.md: ${documentedTests} tests in ${documentedFiles} files`)
console.log(`actual:    ${tests} tests in ${files} files (failed: ${report.numFailedTests})`)
if (tests !== documentedTests || files !== documentedFiles) {
  console.error('Drift: update CLAUDE.md, the stashly skills and the handoff together (newest date wins).')
  process.exit(1)
}
