// tests/e2e/upload.spec.ts
import { test } from './fixtures'
import { UploadPage } from './pages/upload.page'
import { TEST_USER_ID } from './constants'

test.describe('File upload', () => {
  test('dropping a file shows it in the upload panel and reaches done state', async ({
    page,
  }) => {
    const uploadPage = new UploadPage(page)

    await uploadPage.goto(TEST_USER_ID)

    await uploadPage.dropFile({
      name: 'e2e-upload-test.txt',
      sizeBytes: 10_000, // 10 KB — single chunk, fast to upload
      type: 'text/plain',
    })

    await uploadPage.waitForUploadDone('e2e-upload-test.txt')
  })
})
