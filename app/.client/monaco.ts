/**
 * Monaco (VS Code's editor) wired up as a read-only code viewer. Lives in
 * `.client/` so the server bundle never evaluates it — consumers dynamic-import
 * this module from a browser-only effect (same contract as `@/utils/pdf`).
 *
 * Monaco brings language tokenization, the find widget, folding, minimap and
 * — critically — virtualized rendering, so huge logs/scripts don't blow up the
 * DOM the way per-line React rendering did.
 */
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

// One base worker serves every language label: tokenization/colorization runs
// on the main thread (Monarch), and a read-only viewer doesn't need the
// heavyweight per-language workers (ts/json/css/html validation + IntelliSense).
self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

/**
 * Resolve a Monaco language id from a filename using Monaco's own registry
 * (extensions + exact filenames, so `Dockerfile`/`Makefile` resolve too).
 */
export function languageForFile(name: string): string {
  const lower = name.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot === -1 ? '' : lower.slice(dot)
  for (const lang of monaco.languages.getLanguages()) {
    if (ext && lang.extensions?.some((e) => e.toLowerCase() === ext)) {
      return lang.id
    }
    if (lang.filenames?.some((f) => f.toLowerCase() === lower)) return lang.id
  }
  return 'plaintext'
}

/** App theme → Monaco theme. `data-theme` on <html> is the source of truth. */
function isDarkTheme(): boolean {
  const t = document.documentElement.dataset.theme
  if (t === 'dark') return true
  if (t === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Mount a read-only Monaco viewer into `container`. Returns a disposer that
 * tears down the editor, its model, and the theme listeners.
 */
export function createCodeViewer(
  container: HTMLElement,
  text: string,
  fileName: string
): { dispose: () => void } {
  const model = monaco.editor.createModel(text, languageForFile(fileName))
  const editor = monaco.editor.create(container, {
    model,
    readOnly: true,
    domReadOnly: true,
    automaticLayout: true,
    theme: isDarkTheme() ? 'vs-dark' : 'vs',
    fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
    fontSize: 13,
    minimap: { enabled: true },
    stickyScroll: { enabled: true },
    scrollBeyondLastLine: false,
    renderLineHighlight: 'none',
    // Bottom padding keeps the last lines clear of the floating stage toolbar.
    padding: { top: 12, bottom: 56 },
  })

  // Follow app theme changes: Alt+T flips `data-theme`; 'system' follows the
  // OS media query. setTheme is global, but only one viewer mounts at a time.
  const applyTheme = () =>
    monaco.editor.setTheme(isDarkTheme() ? 'vs-dark' : 'vs')
  const observer = new MutationObserver(applyTheme)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', applyTheme)

  return {
    dispose: () => {
      observer.disconnect()
      media.removeEventListener('change', applyTheme)
      editor.dispose()
      model.dispose()
    },
  }
}
