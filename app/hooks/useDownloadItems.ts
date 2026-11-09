import { useCallback, useState } from 'react'
import { href } from 'react-router'
import { createZip } from '@/utils/zip'

type DownloadFile = { id: string; name: string; url: string }

/** Parallel fetches while building a zip: enough to overlap latency, not flood. */
const FETCH_CONCURRENCY = 4

/**
 * Hands a blob to the browser as a download. A fetched blob is required:
 * browsers ignore `<a download>` on cross-origin S3 URLs.
 */
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  // Let the click start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function fetchBytes(file: DownloadFile): Promise<Uint8Array> {
  const res = await fetch(file.url)
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}

/**
 * Downloads the selected files: one file saves straight away, several are
 * fetched and saved as a single stored zip (`createZip`, no dependency).
 * The signed URLs come from `POST /api/items` with intent `download_urls`,
 * which checks read access for every id.
 *
 * @example
 * const { download, isDownloading } = useDownloadItems()
 * <Button disabled={isDownloading} onClick={() => download(selectedIds)}>Download</Button>
 */
export function useDownloadItems() {
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const download = useCallback(async (itemIds: string[]) => {
    if (itemIds.length === 0) return
    setIsDownloading(true)
    setError(null)
    try {
      const body = new FormData()
      body.set('intent', 'download_urls')
      body.set('selectedItems', itemIds.join(','))
      const res = await fetch(href('/api/items'), { method: 'POST', body })
      const json = (await res.json()) as { files?: DownloadFile[]; error?: string }
      if (!res.ok || !json.files?.length) {
        throw new Error(json.error ?? 'Download failed')
      }
      const files = json.files

      if (files.length === 1) {
        const bytes = await fetchBytes(files[0])
        saveBlob(new Blob([bytes as BlobPart]), files[0].name)
        return
      }

      const entries: { name: string; data: Uint8Array }[] = new Array(files.length)
      for (let i = 0; i < files.length; i += FETCH_CONCURRENCY) {
        const batch = files.slice(i, i + FETCH_CONCURRENCY)
        const bytes = await Promise.all(batch.map(fetchBytes))
        bytes.forEach((data, j) => {
          entries[i + j] = { name: batch[j].name, data }
        })
      }
      const zip = createZip(entries)
      saveBlob(
        new Blob([zip as BlobPart], { type: 'application/zip' }),
        `stashly-${files.length}-files.zip`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }, [])

  return { download, isDownloading, error }
}
