/**
 * Prettier in the browser. Lives in `.client/` for the same reason as
 * `monaco.ts` — the server bundle must never evaluate it.
 *
 * `prettier/standalone` is the fs-free build, and each language parser is its
 * own chunk. Everything here is dynamic-imported *inside* the call, so this
 * module stays ~1KB when statically imported by the viewer: a file that is
 * never formatted downloads no Prettier at all, and formatting a `.css` file
 * pulls postcss without dragging in the TypeScript parser.
 */
import type { Options, Plugin } from 'prettier'

/** Mirrors `.prettierrc` so the viewer prints what `pnpm format` would write. */
const PRETTIER_OPTIONS: Options = {
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  useTabs: false,
}

/**
 * Monaco language id → Prettier parser + the plugin chunks it needs.
 * Keys are Monaco's own ids (see `languageForFile`), so `.tsx` arrives as
 * `typescript` and `.jsx` as `javascript` — both parsers handle JSX natively.
 * Languages absent from this map simply don't get the action.
 */
const LANGUAGES: Record<
  string,
  { parser: string; load: () => Promise<unknown[]> }
> = {
  typescript: {
    parser: 'typescript',
    load: () =>
      Promise.all([
        import('prettier/plugins/typescript'),
        import('prettier/plugins/estree'),
      ]),
  },
  javascript: {
    parser: 'babel',
    load: () =>
      Promise.all([
        import('prettier/plugins/babel'),
        import('prettier/plugins/estree'),
      ]),
  },
  json: {
    // Prettier parses JSON through Babel; `json` tolerates comments/trailing
    // commas better than `json-stringify` and preserves key order.
    parser: 'json',
    load: () =>
      Promise.all([
        import('prettier/plugins/babel'),
        import('prettier/plugins/estree'),
      ]),
  },
  css: { parser: 'css', load: () => Promise.all([import('prettier/plugins/postcss')]) },
  scss: { parser: 'scss', load: () => Promise.all([import('prettier/plugins/postcss')]) },
  less: { parser: 'less', load: () => Promise.all([import('prettier/plugins/postcss')]) },
  html: { parser: 'html', load: () => Promise.all([import('prettier/plugins/html')]) },
  yaml: { parser: 'yaml', load: () => Promise.all([import('prettier/plugins/yaml')]) },
  graphql: {
    parser: 'graphql',
    load: () => Promise.all([import('prettier/plugins/graphql')]),
  },
  markdown: {
    parser: 'markdown',
    load: () => Promise.all([import('prettier/plugins/markdown')]),
  },
}

/** True when `Format Document` should be offered for this Monaco language. */
export function canFormatLanguage(languageId: string): boolean {
  return languageId in LANGUAGES
}

/**
 * Format `text` as `languageId`. Rejects when the source doesn't parse —
 * callers should surface that rather than silently leaving the buffer alone,
 * since a syntax error is the interesting half of the answer.
 */
export async function formatDocument(
  text: string,
  languageId: string
): Promise<string> {
  const entry = LANGUAGES[languageId]
  if (!entry) throw new Error(`No Prettier parser for language "${languageId}"`)

  const [{ format }, plugins] = await Promise.all([
    import('prettier/standalone'),
    entry.load(),
  ])

  return format(text, {
    ...PRETTIER_OPTIONS,
    parser: entry.parser,
    plugins: plugins as Plugin[],
  })
}
