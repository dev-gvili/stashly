// tests/e2e/pages/upload.page.ts
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class UploadPage {
  constructor(private readonly page: Page) {}

  async goto(userId: string): Promise<void> {
    await this.page.goto(`/${userId}/stash?layout=grid&take=100`)
    await this.page.locator('[data-sidebar="sidebar"]').first().waitFor({ state: 'visible' })
  }

  /**
   * Opens a folder's grid. A drop here uploads into this folder, and the new
   * cards render in its grid, which is what thumbnails need: one is made only
   * when its card comes on screen.
   */
  async gotoFolder(userId: string, folderId: string): Promise<void> {
    await this.page.goto(`/${userId}/stash/folders/${folderId}?layout=grid&take=100`)
    await this.page.locator('[data-sidebar="sidebar"]').first().waitFor({ state: 'visible' })
  }

  /**
   * Dispatches a synthetic drop event on the DropArea with a programmatically
   * created File. Uses page.evaluate because Playwright cannot natively inject
   * FileSystemEntry objects into DataTransfer — but the DropArea falls back to
   * `item.getAsFile()` when `webkitGetAsEntry()` returns null, which is the
   * case for DataTransfer items created via DataTransfer.items.add(file).
   */
  async dropFile(file: {
    name: string
    sizeBytes: number
    type: string
  }): Promise<void> {
    await this.dropFiles([file])
  }

  /**
   * Drops zero-filled files of exact sizes in a single `drop`, as a real
   * multi-file drag does. Opens the panel first: it starts hidden, and a drop
   * area that is present but hidden never becomes visible on its own.
   */
  async dropFiles(
    files: { name: string; sizeBytes: number; type: string }[]
  ): Promise<void> {
    await this.openPanel()
    await this.page.evaluate((specs) => {
      const dropArea = document.querySelector('.fixed.bottom-8.right-8 [data-testid="upload-drop-area"]')
      if (!dropArea) throw new Error('DropArea not found')

      const dataTransfer = new DataTransfer()
      for (const { name, sizeBytes, type } of specs) {
        dataTransfer.items.add(new File([new Uint8Array(sizeBytes)], name, { type }))
      }

      dropArea.dispatchEvent(
        new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true })
      )
    }, files)
  }

  /**
   * Waits for the item's card to render in the current folder's grid. Reads
   * the page the server rendered, so it proves the row exists, not just that
   * the upload panel said so.
   */
  async expectCardInGrid(fileName: string, timeout = 15_000): Promise<void> {
    await expect(this.page.locator('main').getByText(fileName, { exact: true }).first()).toBeVisible({
      timeout,
    })
  }

  /**
   * Opens the upload panel, which starts hidden (`isVisible` is false in the
   * upload machine's initial context) and whose only opener is the icon button
   * in the app header.
   *
   * Without this the panel's drop area is present but `hidden`, and its file
   * list can never satisfy a visibility assertion — which is why every upload
   * spec times out waiting for an element that is right there in the DOM.
   *
   * Idempotent: it returns as soon as the panel shows, and "Open uploads
   * panel" only ever opens it.
   */
  async openPanel(): Promise<void> {
    const dropArea = this.page.locator(
      '.fixed.bottom-8.right-8 [data-testid="upload-drop-area"]'
    )
    const toggle = this.page.locator('[data-testid="upload-toggle"]').first()

    // Retry the click rather than clicking once and waiting.
    //
    // The button is server-rendered, so Playwright considers it actionable as
    // soon as it paints — which can be before React has hydrated and attached
    // `onClick`. That first click is silently swallowed and the panel never
    // opens, which looks exactly like a broken selector. Re-clicking until the
    // panel actually appears is the only reliable signal that the handler is
    // live.
    // The link sits in the header's New panel (the Uploads button went), so
    // open that popover first unless it is already open.
    const newPanel = this.page.getByRole('button', {
      name: 'New and upload',
      exact: true,
    })
    for (let attempt = 0; attempt < 6; attempt++) {
      if (await dropArea.isVisible()) return
      if (!(await toggle.isVisible())) {
        await newPanel.click()
        await toggle.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => {})
        if (!(await toggle.isVisible())) continue
      }
      await toggle.click()
      try {
        await dropArea.waitFor({ state: 'visible', timeout: 2_000 })
        return
      } catch {
        // Not hydrated yet — fall through and try again.
      }
    }

    throw new Error(
      'Upload panel never opened after 6 clicks on [data-testid="upload-toggle"]'
    )
  }

  /**
   * Drops files with **real, decodable content** — the thumbnail pipeline needs
   * bytes it can actually render, so the zero-filled buffers `dropFile` uses are
   * not enough here.
   *
   *   `png`  a canvas-rendered PNG with real pixels, so stage 1 and stage 2
   *          exercise the genuine decode → resize → WebP-encode path.
   *   `text` real text, because `text-thumbnail.ts` returns null for an empty
   *          file and would silently produce no thumbnail at all.
   *   `bin`  random bytes under an unrenderable mime, to prove the pipeline
   *          reports "no producer" rather than inventing a thumbnail.
   *
   * All files land in a single `drop`, which is what a real multi-file drag does
   * and is the only way to put the scheduler under genuine concurrency.
   */
  async dropRealFiles(
    specs: { name: string; kind: 'png' | 'text' | 'bin'; sizePx?: number }[]
  ): Promise<void> {
    await this.openPanel()

    await this.page.evaluate(async (items) => {
      const dropArea = document.querySelector(
        '.fixed.bottom-8.right-8 [data-testid="upload-drop-area"]'
      )
      if (!dropArea) throw new Error('DropArea not found')

      const makePng = async (name: string, px: number): Promise<File> => {
        const canvas = document.createElement('canvas')
        canvas.width = px
        canvas.height = Math.round(px * 0.75)
        const ctx = canvas.getContext('2d')!
        // Real structure, not flat colour: a gradient plus shapes gives the
        // saliency stage something to find and makes a blank render obvious.
        const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
        g.addColorStop(0, '#1e3a8a')
        g.addColorStop(1, '#f59e0b')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(canvas.width * 0.5, canvas.height * 0.45, px * 0.18, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#111827'
        ctx.font = `${Math.round(px * 0.08)}px sans-serif`
        ctx.fillText('E2E', canvas.width * 0.06, canvas.height * 0.9)

        const blob: Blob = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b!), 'image/png')
        )
        return new File([blob], name, { type: 'image/png' })
      }

      const makeText = (name: string): File => {
        const lines: string[] = []
        for (let i = 0; i < 400; i++) {
          lines.push(
            `${String(i).padStart(4, '0')}  export function sample${i}(value: number) { return value * ${i} }`
          )
        }
        return new File([lines.join('\n')], name, { type: 'text/plain' })
      }

      const makeBin = (name: string): File => {
        const bytes = new Uint8Array(4096)
        for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) % 251
        return new File([bytes], name, { type: 'application/octet-stream' })
      }

      const dataTransfer = new DataTransfer()
      for (const spec of items) {
        const file =
          spec.kind === 'png'
            ? await makePng(spec.name, spec.sizePx ?? 480)
            : spec.kind === 'text'
              ? makeText(spec.name)
              : makeBin(spec.name)
        dataTransfer.items.add(file)
      }

      dropArea.dispatchEvent(
        new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true })
      )
    }, specs)
  }

  /**
   * Waits for the upload item row to appear.
   * The row is identified by the visible file name text.
   */
  async waitForUploadStarted(
    fileName: string,
    timeout = 10_000
  ): Promise<void> {
    await expect(
      this.page
        .locator('li')
        .filter({ hasText: fileName })
    ).toBeVisible({ timeout })
  }

  /**
   * Waits for the upload item row to reach `done` or `itemCreated`.
   * The row is identified by the visible file name text.
   *
   * `done` (bytes in S3) lasts only until the item row is written, which is a
   * single request away, so waiting for `done` alone can miss it entirely.
   */
  async waitForUploadDone(
    fileName: string,
    timeout = 60_000
  ): Promise<void> {
    await expect(
      this.page
        .locator('li:is([data-state="done"], [data-state="itemCreated"])')
        .filter({ hasText: fileName })
    ).toBeVisible({ timeout })
  }

  /** Waits for the upload item row to reach `itemCreated`: its row exists. */
  async waitForItemCreated(fileName: string, timeout = 90_000): Promise<void> {
    await expect(
      this.page.locator('li[data-state="itemCreated"]').filter({ hasText: fileName })
    ).toBeVisible({ timeout })
  }
}
