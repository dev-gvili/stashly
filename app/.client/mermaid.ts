/**
 * Mermaid wired up as a diagram renderer for the Markdown reader. Lives in
 * `.client/` so the server bundle never evaluates it — consumers dynamic-import
 * this module from a browser-only effect (same contract as `./monaco` and
 * `@/utils/pdf`).
 *
 * Mermaid is a heavy graph library (its own parser plus dagre/cytoscape
 * layout), so nothing here may be reachable from a static import: a reader
 * whose document contains no ```mermaid fence must never download it.
 *
 * Theming: like the Monaco viewer, the palette is read at render time from the
 * live design tokens rather than hard-coded, so a diagram sits in the same Ink
 * greyscale as the code blocks around it and follows theme flips exactly.
 */
import mermaid from 'mermaid'

/**
 * Resolve one CSS custom property to `#rrggbb` by painting it on a 1×1 canvas.
 *
 * Mermaid runs every theme colour through khroma (it derives borders, contrast
 * text and hover tints from them), and khroma cannot parse `oklch(…)` — which
 * is exactly how globals.css spells its tokens, and what `getComputedStyle`
 * hands back. An unparseable colour makes mermaid throw mid-layout, so the
 * values are flattened to hex before they ever reach it.
 *
 * `monaco.ts` carries a twin of this for the same reason. They are deliberately
 * not shared: importing anything from `./monaco` here would pull the entire
 * editor into the diagram chunk, defeating the point of loading mermaid lazily.
 */
function tokenToHex(
  ctx: CanvasRenderingContext2D,
  style: CSSStyleDeclaration,
  name: string,
  fallback: string
): string {
  const value = style.getPropertyValue(name).trim()
  if (!value) return fallback
  try {
    ctx.fillStyle = fallback
    ctx.fillStyle = value // invalid values leave the fallback in place
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return fallback
  }
}

/** Fallbacks approximating globals.css if token resolution ever fails. */
const FALLBACK = {
  light: {
    card: '#ffffff',
    fg: '#232323',
    muted: '#616161',
    surface: '#f3f3f3',
    border: '#d7d7d7',
    input: '#c8c8c8',
    hue: '#5e6ad2',
  },
  dark: {
    card: '#1f1f1f',
    fg: '#f4f4f4',
    muted: '#a1a1a1',
    surface: '#2a2a2a',
    border: '#3e3e3e',
    input: '#373737',
    hue: '#96a0e8',
  },
} as const

/** App theme → dark flag. `data-theme` on <html> is the source of truth. */
function isDarkTheme(): boolean {
  const t = document.documentElement.dataset.theme
  if (t === 'dark') return true
  if (t === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Resolve the Ink palette from the tokens in scope at `scope`.
 *
 * Read from the *block's own element* rather than `:root` so `--md-ink-hue`
 * resolves: globals.css scopes that one deliberately to `.markdown-stage`
 * (it is hand-picked syntax colour, not a design token), and it is inherited
 * down to the diagram. One hue for identifiers in code and for node borders in
 * a diagram is what makes the two read as the same system.
 */
function resolvePalette(scope: HTMLElement) {
  const dark = isDarkTheme()
  const fb = FALLBACK[dark ? 'dark' : 'light']
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const style = getComputedStyle(scope)
  if (!ctx) return fb
  const t = (name: string, fallback: string) =>
    tokenToHex(ctx, style, name, fallback)
  return {
    card: t('--card', fb.card),
    fg: t('--foreground', fb.fg),
    muted: t('--muted-foreground', fb.muted),
    surface: t('--muted', fb.surface),
    border: t('--border', fb.border),
    input: t('--input', fb.input),
    hue: t('--md-ink-hue', fb.hue),
  }
}

/**
 * Mermaid keeps one global config, so it is (re)initialized per render rather
 * than once per page: a theme flip has to repaint diagrams that are already on
 * screen, and there is no per-call theme override.
 *
 * - `securityLevel: 'strict'` because the Markdown is *uploaded content*.
 *   Mermaid's 'loose' level lets a diagram's labels carry arbitrary HTML, which
 *   would make any shared `.md` file a stored-XSS vector. Strict costs nothing
 *   here beyond raw HTML in labels, which no honest diagram needs.
 * - `htmlLabels: false` follows from that: with HTML labels sanitized away,
 *   SVG `<text>` renders the labels and `<br/>` still breaks a line, which is
 *   how the docs in this repo write multi-line nodes.
 */
function configure(scope: HTMLElement) {
  const p = resolvePalette(scope)
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true, // errors surface as a thrown promise, not DOM
    theme: 'base',
    fontFamily: getComputedStyle(scope).fontFamily,
    flowchart: { htmlLabels: false, curve: 'basis' },
    themeVariables: {
      background: p.card,
      // Nodes: a muted surface outlined in the one syntax hue, so a diagram
      // carries the same accent identifiers do in a code block.
      primaryColor: p.surface,
      primaryBorderColor: p.hue,
      primaryTextColor: p.fg,
      secondaryColor: p.card,
      secondaryBorderColor: p.input,
      secondaryTextColor: p.fg,
      tertiaryColor: p.card,
      tertiaryBorderColor: p.input,
      tertiaryTextColor: p.fg,
      mainBkg: p.surface,
      nodeBorder: p.hue,
      nodeTextColor: p.fg,
      textColor: p.fg,
      titleColor: p.fg,
      // Edges stay grey: the hue is an accent, and every arrow wearing it
      // turns the diagram into a wash of indigo.
      lineColor: p.muted,
      edgeLabelBackground: p.card,
      // Subgraphs read as a frame, not a filled box.
      clusterBkg: p.card,
      clusterBorder: p.border,
      fontSize: '13px',
    },
  })
}

let renderCount = 0

/**
 * Render one mermaid source to an SVG string.
 *
 * `scope` is the element the diagram will live in — it supplies the design
 * tokens and the font stack, so the caller never has to describe the theme.
 *
 * Throws on a syntax error (mermaid's own message). Callers are expected to
 * fall back to showing the source: a diagram that cannot be drawn is still a
 * fenced block someone wrote, and silently blanking it would lose content.
 */
export async function renderMermaid(
  code: string,
  scope: HTMLElement
): Promise<string> {
  configure(scope)
  renderCount += 1
  // Mermaid mounts a temporary node under this id while measuring; it must be
  // a valid CSS identifier and unique per render, or a second diagram on the
  // page overwrites the first one's measurements.
  const { svg } = await mermaid.render(`mermaid-md-${renderCount}`, code)
  return svg
}
