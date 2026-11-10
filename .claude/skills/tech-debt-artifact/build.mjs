// Renders docs/tech-debt.md into the "Stashly Tech Debt" artifact page.
// usage: node .claude/skills/tech-debt-artifact/build.mjs <out.html>
// The stylesheet lives in page-head.html beside this file; page structure
// (header chips, pills, done rows) is decided here, never by hand-editing the
// published HTML.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const outPath = process.argv[2]
if (!outPath) {
  console.error('usage: node build.mjs <out.html>')
  process.exit(1)
}

// marked is not a direct dependency; use the newest copy pnpm already installed.
const pnpmDir = join(repo, 'node_modules/.pnpm')
const markedDir = readdirSync(pnpmDir)
  .filter((d) => /^marked@\d+\.\d+\.\d+$/.test(d))
  .sort((a, b) => {
    const va = a.split('@')[1].split('.').map(Number)
    const vb = b.split('@')[1].split('.').map(Number)
    return vb[0] - va[0] || vb[1] - va[1] || vb[2] - va[2]
  })[0]
const markedEntry = markedDir && join(pnpmDir, markedDir, 'node_modules/marked/lib/marked.esm.js')
if (!markedEntry || !existsSync(markedEntry)) {
  console.error('marked not found under node_modules/.pnpm; run pnpm install')
  process.exit(1)
}
const { Marked } = await import(pathToFileURL(markedEntry).href)

const head = readFileSync(join(here, 'page-head.html'), 'utf8').trim()
const source = readFileSync(join(repo, 'docs/tech-debt.md'), 'utf8')

const updated = source.match(/^\*\*Now \(([^)]+)\):\*\*/m)?.[1]
if (!updated) {
  console.error('docs/tech-debt.md has no "**Now (<date>):**" line to date the page from')
  process.exit(1)
}

const slug = (s) =>
  s.replace(/`/g, '').toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')

const marked = new Marked({ gfm: true })
marked.use({
  renderer: {
    heading({ tokens, depth, text }) {
      return `<h${depth} id="${slug(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`
    },
  },
})

// The page header replaces the document's H1.
let body = marked.parse(source.replace(/^# .*\n/, ''))

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (iso) => {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

const pillFor = (status) => {
  if (/^Resolved in code/.test(status)) return null
  if (/^Resolved/.test(status)) return 'g'
  if (/^Partly done/.test(status)) return 'm'
  if (/^Open/.test(status)) return 'o'
  if (/^New/.test(status)) return 'c'
  if (/^Declined/.test(status)) return 'x'
  return null
}

// Tables: wrap for horizontal scroll, grey out struck rows, pill the statuses.
body = body.replace(/<table>([\s\S]*?)<\/table>/g, (_table, inner) => {
  const headers = [...inner.matchAll(/<th>(.*?)<\/th>/g)].map((m) => m[1])
  const isLeft = headers.includes('What remains')
  const isRegister = headers.includes('Priority')
  inner = inner.replace(/<tr>\n([\s\S]*?)<\/tr>/g, (row, cells) => {
    const tds = [...cells.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1])
    if (tds.length === 0) return row
    if (isLeft) {
      let [num, item, score, remains, blocked] = tds
      item = item.replace(/<strong>new<\/strong>/, '<span class="pill c">new</span>')
      const done = remains.match(/^Resolved (\d{4}-\d{2}-\d{2})(.*?):\s*/)
      if (done) {
        item += ` <span class="pill g">Resolved ${shortDate(done[1])}</span>`
        remains = `Done${done[2]}: ${remains.slice(done[0].length)}`
      }
      const declined = remains.match(/^Declined (\d{4}-\d{2}-\d{2}):\s*/)
      if (declined) {
        item += ` <span class="pill x">Declined ${shortDate(declined[1])}</span>`
        const rest = remains.slice(declined[0].length)
        remains = rest.charAt(0).toUpperCase() + rest.slice(1)
      }
      tds.splice(0, 5, num, item, score, remains, blocked)
    }
    if (isRegister) {
      const status = tds[tds.length - 1]
      const cls = pillFor(status)
      if (cls) tds[tds.length - 1] = `<span class="pill ${cls}">${status}</span>`
    }
    const struck = /<del>/.test(tds[1] ?? '')
    return `<tr${struck ? ' class="done"' : ''}>\n${tds.map((t) => `<td>${t}</td>`).join('\n')}\n</tr>`
  })
  return `<div class="tbl"><table>${inner}</table></div>`
})

const header = `<header><div class="eyebrow">Tech debt register · Stashly</div><h1>Tech debt, ranked</h1><div class="meta"><span class="chip">Audit 24 Sep 2026</span><span class="chip">Re-audit 8 Oct 2026</span><span class="chip">Updated ${updated}</span><span class="chip">Priority = (Impact + Risk) × (6 − Effort)</span><span class="chip">Source: docs/tech-debt.md</span></div></header>`

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stashly Tech Debt</title>
${head}
</head>
<body>
<div class="doc">${header}
${body}</div>
</body>
</html>
`
writeFileSync(outPath, page)

// Checks the caller reports: anything here is a rendering bug, not a doc problem.
const leftoverStrike = (page.match(/~~/g) ?? []).length
const items = (source.match(/^### \d+\. /gm) ?? []).length
const itemAnchors = (page.match(/<h3 id="\d+-/g) ?? []).length
console.log(`wrote ${outPath} (${page.length} bytes) · marked ${markedDir.split('@')[1]} · updated ${updated}`)
console.log(`items ${items}, item anchors ${itemAnchors}, leftover ~~ ${leftoverStrike}`)
if (leftoverStrike > 0 || itemAnchors !== items) process.exit(2)
