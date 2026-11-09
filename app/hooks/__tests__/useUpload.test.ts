import { describe, expect, it } from 'vitest'
import { withEntryPath } from '@/hooks/useUpload'

describe('withEntryPath', () => {
  it('gives a file from a dropped folder its folder path', () => {
    const file = withEntryPath(new File(['x'], 'home.tsx'), '/app/routes/home.tsx')
    expect(file.webkitRelativePath).toBe('app/routes/home.tsx')
  })

  it('leaves a loose dropped file without a path', () => {
    const file = withEntryPath(new File(['x'], 'notes.md'), '/notes.md')
    // Node's File has no webkitRelativePath at all; a browser's reads ''.
    expect(file.webkitRelativePath || '').toBe('')
  })

  it('keeps a path the browser already set', () => {
    const file = new File(['x'], 'a.ts')
    Object.defineProperty(file, 'webkitRelativePath', { value: 'picked/a.ts' })
    expect(withEntryPath(file, '/dropped/a.ts').webkitRelativePath).toBe('picked/a.ts')
  })
})
