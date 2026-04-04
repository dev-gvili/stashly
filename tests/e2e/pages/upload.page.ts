// tests/e2e/pages/upload.page.ts
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export class UploadPage {
  constructor(private readonly page: Page) {}

  async goto(userId: string): Promise<void> {
    await this.page.goto(`/${userId}/stash`)
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
    await this.page.locator('[data-testid="upload-drop-area"]').waitFor({ state: 'visible' })
    await this.page.evaluate(
      ({ name, sizeBytes, type }) => {
        const dropArea = document.querySelector(
          '[data-testid="upload-drop-area"]'
        )
        if (!dropArea) throw new Error('DropArea not found')

        const fileData = new Uint8Array(sizeBytes)
        const syntheticFile = new File([fileData], name, { type })

        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(syntheticFile)

        const dropEvent = new DragEvent('drop', {
          dataTransfer,
          bubbles: true,
          cancelable: true,
        })
        dropArea.dispatchEvent(dropEvent)
      },
      { name: file.name, sizeBytes: file.sizeBytes, type: file.type }
    )
  }

  /**
   * Waits for the upload item row to reach data-state="done".
   * The row is identified by the visible file name text.
   */
  async waitForUploadDone(
    fileName: string,
    timeout = 30_000
  ): Promise<void> {
    await expect(
      this.page
        .locator('li[data-state="done"]')
        .filter({ hasText: fileName })
    ).toBeVisible({ timeout })
  }
}
