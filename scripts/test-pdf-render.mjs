import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js'
import fs from 'fs'

// Silence verbosity
pdfjs.GlobalWorkerOptions.verbosity = 0

const pdfPath = 'c:/Users/PoshI/Downloads/Getting_Started_with_Google_Drive.pdf'
const pdfData = fs.readFileSync(pdfPath)

// Try to load the PDF and render
async function test() {
  try {
    console.log('[test] Loading PDF...')
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(pdfData),
      cMapUrl: '/pdfjs-cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/pdfjs-standard-fonts/',
      disableFontFace: false,
    }).promise

    console.log(`[test] PDF loaded. Pages: ${doc.numPages}`)
    const page = await doc.getPage(1)
    console.log('[test] First page loaded')

    // Try to get text
    try {
      const textContent = await page.getTextContent()
      const text = textContent.items.map(item => ('str' in item ? item.str : '')).join('')
      console.log(`[test] Text extracted (${text.length} chars): "${text.substring(0, 100)}"`)
    } catch (err) {
      console.error('[test] Text extraction failed:', err.message)
    }

    page.cleanup()
    doc.destroy()
  } catch (err) {
    console.error('[test] Error:', err.message)
    if (err.stack) console.error(err.stack)
  }
}

test()
