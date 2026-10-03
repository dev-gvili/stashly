import { describe, expect, it } from 'vitest'
import {
  generateStage1Preview,
  generateStage2Resize,
  generateStage3Salient,
  producerFor,
} from '@/utils/thumbnail-stages'

/**
 * Which producer a file gets. This replaced four `if (file.type …)` ladders
 * that had to agree by hand; the order here is the order they checked in.
 * The compute itself needs a browser (worker, `<video>`, WebGPU) and is not
 * exercised.
 */
const file = (name: string, type: string) => new File(['x'], name, { type })

describe('producerFor', () => {
  it.each([
    ['photo.png', 'image/png', 'image'],
    ['scan.jpg', 'image/jpeg', 'image'],
    ['report.pdf', 'application/pdf', 'pdf'],
    ['clip.mp4', 'video/mp4', 'video'],
    ['notes.md', 'text/markdown', 'text'],
    ['main.ts', 'video/mp2t', 'video'],
  ])('%s (%s) → %s', (name, type, expected) => {
    expect(producerFor(file(name, type))?.name).toBe(expected)
  })

  it('has no producer for an archive', () => {
    expect(producerFor(file('a.zip', 'application/zip'))).toBeNull()
  })

  it('gives only images a salient crop', () => {
    expect(producerFor(file('a.png', 'image/png'))?.salientCrop).toBeTypeOf('function')
    expect(producerFor(file('a.pdf', 'application/pdf'))?.salientCrop).toBeUndefined()
  })
})

describe('stage functions for a type with no producer', () => {
  const zip = file('a.zip', 'application/zip')

  it('answer null rather than throwing', async () => {
    await expect(generateStage1Preview(zip)).resolves.toBeNull()
    await expect(generateStage2Resize(zip)).resolves.toBeNull()
    await expect(generateStage3Salient(zip)).resolves.toBeNull()
  })

  it('skip stage 3 for a PDF without loading the model', async () => {
    await expect(generateStage3Salient(file('a.pdf', 'application/pdf'))).resolves.toBeNull()
  })
})
