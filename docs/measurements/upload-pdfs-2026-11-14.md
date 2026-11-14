# Upload of `X:\pdfs` — live measurement, run 1 (14 Nov 2026)

One real folder upload, measured in the browser from the moment the folder was chosen until nothing was left to do. All numbers come from a recorder injected into the page; nothing is estimated unless it says so. Times are seconds after **T0**.

- **T0:** 2026-11-14T03:20:51.993Z — the `change` event of the folder input (`<input webkitdirectory>`, "New and upload → Folders"), picked by the owner in the in-app browser pane.
- **Folder:** `X:\pdfs`, 37 PDFs, 309,247,379 bytes (295 MB), flat. Filed into one new subfolder `pdfs` inside the destination folder.
- **Account:** `usr_jY94r4AQIyrd9N0xPPME5Q`. **Destination folder:** `item_vMhZtZXhSx-4mO4Jypifrw` ("Upload measurement 14 Nov (test)"). Subfolder `pdfs`: `item__33YiIlb34ojjh6ph2Ft3w`.
- **Machine:** Windows 11, NVIDIA Turing GPU (WebGPU on), 16 logical cores, dev server on :80 (Vite dev mode, not a production build), Tigris storage.
- **Product code:** unchanged. The recorder (wrappers around `fetch` and the `Worker` constructor, a long-task observer, a 25 ms loop-lag timer) lived only in the page.

## Read this first: what limits these numbers

1. **The destination folder was not clean.** The `pdfs` folder holds **74 files, not 37**: the owner picked the folder twice. The first pick (which this recorder did not see; why is unknown) resolved its folders at 03:19:49.2Z (T0 − 62.8 s), created its rows 03:19:51.2–03:20:21.4Z (T0 − 60.8 s to T0 − 30.5 s) and its indexing stopped after the vectors of 5 files, the last at 03:20:29Z (T0 − 22 s), per Backend Dev's database and Vinktar readings. It therefore ended before T0, so it did not overlap the measured run, but its 37 items sit in the same folder: any total taken from the folder (74 items, 618,494,758 bytes charged) is double. The measured run is the **second pick (T0)**. The recorder counts only this page's own requests and every per-file row below is keyed by item id, so the browser-side figures are this run's alone. (An earlier version of this file put the first upload at 03:16:13Z; that was the parent folder's creation time, not an upload.)
2. **Thumbnails are made only for cards that are on screen** (by design). Nothing was on screen after the upload, so none were made until I opened the `pdfs` folder at T0 + 499 s and scrolled through the cards at 2.5 s per card. Thumbnail times depend on that scroll pace and are not a pipeline throughput.
3. **Not measured:** model downloads and inference time inside workers (Cache Storage is invisible to the page; the PaddleOCR cache was already present and no embedding-model cache was seen, so the first embedding run may have included a download); which OCR engine each page used beyond "the PaddleOCR worker started" (a GLM-OCR fallback runs on the page, not in a worker); GPU use; server time per request (Backend Dev's part); the moment the `pdfs` folder card appeared (checked at T0 + 11 s: not there; at T0 + 79 s: there).
4. **One run.** A second run was not made; it needs a second fresh folder and the owner's pick again.

## Batch timeline

| Event | Time |
|---|---|
| T0 folder chosen | 0.0 s |
| Quota pre-check, `resolve_upload_folders` (1 call), hash worker started | 0.1 s |
| First `create-multipart-upload` sent / last one answered | 0.1 s / 1.2 s |
| First S3 part PUT started / last part PUT finished | 0.5 s / 30.9 s |
| **All 84 part PUTs in flight at once** (peak) | 1.2 s |
| Peak concurrent file uploads | 37 (every file; the limit is 100) |
| First `create_upload_item` answered / **last item created** | 1.8 s / 31.3 s |
| First / last `save_media_metadata` (text layer, page count) | 2.2 s / 31.3 s |
| Embedding worker started | 33.1 s |
| First embedding save | 45.9 s |
| PaddleOCR worker started | 56.1 s |
| First / last `save_ocr_page` | 62.1 s / 299.4 s |
| Embedding worker started again (it had released after idle) | 258 s |
| **Last indexing write** (an embedding save): everything the page saves for search | **319.9 s** |
| Opened the `pdfs` folder (client-side navigation) | 499 s |
| First / last thumbnail written (stage 2 PATCH) | 500.4 s / 797.7 s |

**Time to first row on the page:** not applicable as measured. The files went into the `pdfs` subfolder, so the destination page showed one new folder, not file rows.
**Time to the last file fully done:** indexing complete at **319.9 s** (5 min 20 s). With thumbnails, 797.7 s (13 min 18 s), but see limit 2.

Transfer: 309,247,379 bytes between 0.5 s and 30.9 s = **10.17 MB/s average**. MB finished per 5 s window: 0–5 s 24.4 · 5–10 s 56.2 · 10–15 s 52.2 · 15–20 s 37.3 · 20–25 s 59.8 · 25–30 s 56.0 · 30–31 s 23.3 (about 4.9, 11.2, 10.4, 7.5, 12.0, 11.2 MB/s; the last window is partial). Parts are 5 MiB.

## Per file (all 37)

Transfer = first part PUT start to last part PUT end. Created = `create_upload_item` answered. Meta = `save_media_metadata` answered. OCR = pages saved and first–last save time (no OCR column entry means the PDF had a text layer or no pages were OCR'd). Thumbnail = stage-2 write time, with the time its card reached the screen. Done = latest of meta, OCR and thumbnail. No file failed to upload, no request was retried, no answer was non-2xx.

| # | File | MB | Parts | Transfer s | Created s | Meta s | OCR | Thumbnail s | Done s |
|---|---|---|---|---|---|---|---|---|---|
| 1 | edge_ai.pdf | 0.04 | 1 | 0.5–1.5 | 1.8 | 2.2 | – | 599.2 (on screen 598.8) | 599.2 |
| 2 | AI_Enhanced_File_Hosting.pdf | 0.02 | 1 | 0.5–2.5 | 2.9 | 2.9 | – | 500.4 (first card, on screen as the folder opened) | 500.4 |
| 3 | Cloud_Storage_Deep_Dive.pdf | 0.01 | 1 | 0.5–2.7 | 3.0 | 3.0 | – | 595.1 (on screen 593.8) | 595.1 |
| 4 | cloud_storage_architectures.pdf | 0.02 | 1 | 0.5–2.8 | 3.1 | 3.1 | – | 589.9 (on screen 588.8) | 589.9 |
| 5 | Getting Started.pdf | 0.07 | 1 | 0.6–3.1 | 3.5 | 3.5 | – | 615.1 (on screen 613.8) | 615.1 |
| 6 | Foundations of Distributed Storage Architecture.pdf | 0.32 | 1 | 0.6–3.1 | 3.5 | 3.6 | – | 611.9 (on screen 611.3) | 611.9 |
| 7 | Getting_Started_with_Google_Drive.pdf | 0.69 | 1 | 0.6–3.3 | 3.7 | 3.8 | – | 620.2 (on screen 618.9) | 620.2 |
| 8 | Google_Workspace_Introduction.pdf | 0.01 | 1 | 0.6–3.3 | 3.8 | 3.9 | – | 624.4 (on screen 623.9) | 624.4 |
| 9 | Exabyte_Architecture.pdf | 22.05 | 5 | 0.5–5.2 | 5.6 | 5.7 | 15 p, 62.1–89.8 | 606.8 (on screen 606.3) | 606.8 |
| 10 | Stashly — Item Page audio.pdf | 0.27 | 1 | 0.6–5.6 | 6.1 | 6.2 | – | none (see below) | 6.2 |
| 11 | Smart_Edge_Heavy_Database_Architecture.pdf | 11.69 | 3 | 0.6–5.8 | 6.1 | 6.2 | 15 p, 63.3–90.4 | 629.7 (on screen 628.9) | 629.7 |
| 12 | Stashly — Item Page pdf.pdf | 0.26 | 1 | 0.6–5.9 | 6.3 | 6.3 | – | none (see below) | 6.3 |
| 13 | Stashly — Item Page pdf2.pdf | 0.26 | 1 | 0.6–6.1 | 6.5 | 6.7 | – | none (see below) | 6.7 |
| 14 | Stashly — Item Page.pdf | 0.47 | 1 | 0.6–6.1 | 6.5 | 6.7 | – | none (see below) | 6.7 |
| 15 | Stashly-page-toolbar.pdf | 0.51 | 1 | 0.6–6.3 | 6.6 | 6.7 | 1 p, 92.0–92.1 | 639.3 (on screen 639.0) | 639.3 |
| 16 | Stashly-page-toolbar_3.pdf | 2.71 | 1 | 0.7–7.2 | 7.6 | 7.7 | 13 p, 93.8–117.5 | 651.9 (on screen 651.5) | 651.9 |
| 17 | Solar Icons Set (Vol.2) (Community).pdf | 14.31 | 3 | 0.6–8.1 | 8.5 | 9.7 | – | 635.0 (on screen 633.9) | 635.0 |
| 18 | Stashly-page-toolbar_2.pdf | 2.71 | 1 | 0.6–8.9 | 9.2 | 9.8 | 13 p, 95.9–120.8 | 644.5 (on screen 644.0) | 644.5 |
| 19 | Stashly_Architectural_Blueprint.pdf | 18.97 | 4 | 0.7–9.9 | 10.2 | 10.3 | 15 p, 120.0–142.7 | 677.1 (on screen 676.6) | 677.1 |
| 20 | Stashly_Architecture_Blueprint.pdf | 14.58 | 3 | 0.7–11.9 | 12.3 | 12.4 | 14 p, 122.0–144.1 | 690.4 (on screen 689.2) | 690.4 |
| 21 | Stashly_Architecture_Report.pdf | 11.40 | 3 | 0.8–13.8 | 14.1 | 14.1 | 12 p, 144.9–161.5 | 695.5 (on screen 694.2) | 695.5 |
| 22 | Stashly_Architectural_Teardown.pdf | 15.75 | 4 | 0.7–14.1 | 14.4 | 14.4 | 15 p, 145.2–166.5 | 682.1 (on screen 681.6) | 682.1 |
| 23 | Stashly_Architecture_Audit.pdf | 20.45 | 4 | 0.8–17.0 | 17.3 | 17.4 | 15 p, 162.9–180.5 | 687.2 (on screen 686.7) | 687.2 |
| 24 | Stashly_Atomic_Upload_Architecture.pdf | 14.97 | 3 | 0.8–17.5 | 17.8 | 17.8 | 15 p, 167.8–184.7 | 699.8 (on screen 699.2) | 699.8 |
| 25 | Stashly_Browser_IDE_Architecture.pdf | 14.33 | 3 | 0.9–17.5 | 17.9 | 17.9 | 15 p, 182.0–199.2 | 707.7 (on screen 706.8) | 707.7 |
| 26 | Stashly_Engineering_Retrospective.pdf | 12.60 | 3 | 0.9–21.0 | 21.3 | 21.3 | 14 p, 186.0–202.3 | 745.3 (on screen 744.3) | 745.3 |
| 27 | Stashly_Platform_Blueprint.pdf | 20.25 | 4 | 0.9–22.8 | 23.1 | 23.2 | 15 p, 200.5–218.8 | 750.6 (on screen 749.4) | 750.6 |
| 28 | Stashly_Reference_Architecture.pdf | 15.37 | 3 | 0.9–24.3 | 24.6 | 24.7 | 13 p, 203.6–219.4 | 758.0 (on screen 756.9) | 758.0 |
| 29 | Stashly_Technical_Atlas.pdf | 13.68 | 3 | 1.0–25.5 | 25.8 | 25.9 | 15 p, 220.1–236.8 | 767.4 (on screen 766.9) | 767.4 |
| 30 | Stashly_System_Transformation_Blueprint.pdf | 12.33 | 3 | 1.0–26.1 | 26.4 | 26.5 | 13 p, 220.4–234.5 | 763.3 (on screen 761.9) | 763.3 |
| 31 | Stashly_Technical_Blueprint.pdf | 18.34 | 4 | 1.0–28.3 | 28.6 | 28.7 | 15 p, 236.2–257.6 | 770.5 (on screen 769.5) | 770.5 |
| 32 | Stashly_Technical_Debt_Audit.pdf | 12.50 | 3 | 1.0–28.6 | 28.9 | 28.9 | 14 p, 238.2–258.0 | 778.1 (on screen 777.0) | 778.1 |
| 33 | Stashly_Engineering_Intelligent_Platform.pdf | 11.67 | 3 | 0.9–29.9 | 30.2 | 30.2 | 15 p, 262.5–282.8 | 743.3 (on screen 741.8) | 743.3 |
| 34 | storage_architecture.pdf | 0.02 | 1 | 1.2–30.0 | 30.3 | 30.4 | – | 790.6 (on screen 789.5) | 790.6 |
| 35 | system_design.pdf | 0.10 | 1 | 1.2–30.2 | 30.4 | 30.5 | – | 797.7 (on screen 797.1) | 797.7 |
| 36 | Stashly_Technical_Turnaround.pdf | 12.81 | 3 | 1.1–30.6 | 30.9 | 31.0 | 15 p, 265.3–284.5 | 780.2 (on screen 779.5) | 780.2 |
| 37 | Stashly_Upload_Architecture_Overhaul.pdf | 12.71 | 3 | 1.1–30.9 | 31.2 | 31.3 | 15 p, 284.0–299.4 | 787.5 (on screen 787.0) | 787.5 |

OCR ran for 22 files, 302 pages in total (the app reads at most 15 pages per PDF).

**No thumbnail:** `Stashly — Item Page audio.pdf`, `Stashly — Item Page pdf.pdf`, `Stashly — Item Page pdf2.pdf`, `Stashly — Item Page.pdf` (0.26–0.47 MB each; the names contain an em dash). For each, the pipeline asked for the original (`intent=source`, then the S3 GET, at 654–672 s) and then wrote nothing: no presign, no PUT, no PATCH, no console message. Their cards stayed without an image. The cause was not investigated. Their Done time excludes a thumbnail.

Thumbnails that were made took 0.4–1.4 s from card on screen to written (32 of the 33; the first one was made as the folder opened).

## Requests by endpoint (whole recording, T0 to 831 s, 1,127 requests)

| Endpoint | Count |
|---|---|
| S3 part PUT | 84 |
| `POST /api/s3/upload` create-multipart / complete-multipart | 37 / 37 |
| `POST /api/items` `create_upload_item` / `resolve_upload_folders` | 37 / 1 |
| `POST /api/items` `save_media_metadata` | 37 |
| `POST /api/items` `save_ocr_page` | 302 |
| `POST /api/items` `save_search_chunk_embeddings` | 317 |
| `POST /api/quota` | 1 |
| `GET /api/thumbnails/:id` `intent=presign` / `intent=source` | 61 / 36 |
| S3 GET of an original (for thumbnails) | 36 |
| S3 thumbnail PUT / `PATCH /api/thumbnails/:id` (stage 2) | 61 / 61 |
| `GET /api/notifications` | 12 |
| Folder page data loads (`.data`) | 5 |
| `GET /api/items` (my own probe of pending embeddings, after the run) | 2 |

The 61 thumbnails include items of the first pick that were also on screen, so only 33 of them are this run's files.
Request durations: `create_upload_item` 111–216 ms · `save_media_metadata` 16–114 ms · `save_ocr_page` 19–189 ms · `save_search_chunk_embeddings` 19–300 ms.
OCR and embedding saves per 30 s (OCR / embedding): 30 s 0/9 · 60 s 29/0 · 90 s 28/4 · 120 s 37/0 · 150 s 44/0 · 180 s 47/0 · 210 s 48/0 · 240 s 33/2 · 270 s 36/50 · 300 s 0/252.

## Main thread, workers, errors

- **Long tasks (≥ 50 ms) and loop lag (> 150 ms) during the upload and indexing phases:** one of each, at T0 + 0.1 s (410 ms long task, 424 ms lag) when the folder was handed over. Nothing else until the thumbnail phase.
- **During the thumbnail phase (my navigation and scrolling):** 352 ms long task and 378 ms lag at 499.2 s (opening the folder); 190 ms and 58 ms long tasks and a 182 ms lag at 736.7–737.3 s.
- Before T0 the page logged timer gaps of about 1 s while the pane was hidden; those samples are excluded.
- **Workers started (page `new Worker`):** hash 0.1 s · thumbnail compute 1.8 s · embedding 33.1 s · PaddleOCR 56.1 s · embedding again 258 s.
- Console errors and warnings: none. Failed requests: none. Retried part PUTs: none (84 PUTs, no part repeated).

## Left over

A probe after the run, `GET /api/items?intent=pending_search_embeddings`, answered **37 chunks** still waiting for a vector, account-wide. The response carries no item id, so the page cannot attribute them. Backend Dev's database check puts them in the first (unrecorded) pick: 22 of its files have no search row and 37 chunks have no vector, because its indexing stopped early. This run's items were all indexed (last vector at T0 + 319.87 s, server side).

## Server and database side (Backend Dev)

Measured from the database and Vinktar, read-only; no logging was added and the server was not restarted. Times are seconds after the same T0 (03:20:51.993Z); negative means before T0. Server code: `X:\stashly` at `e8a5f82` in dev mode, Postgres 17.5 on the same machine.

**Sources.** `Item.createdAt` (a JS Date taken just before the insert statement), `Search`/`SearchChunk`/`Thumbnail` rows, the Vinktar events `upload_folders_resolved`, `upload_started`, `upload_transfer_completed`, `file_uploaded` (sent after the commit), `media_metadata_saved`, `ocr_page_saved`, `search_chunks_embedded`, `thumbnail_stage_saved`, `route_request_slow`/`route_request_failed`, the Postgres log, and a sampler polling the database every 250 ms from 03:17:56Z (folder size and child count, quota, both delta logs, lock waits, deadlock counter; 6–18 ms per sample).

### The earlier upload, placed exactly

The folder received two complete uploads of `X:\pdfs`, each with its own `upload_folders_resolved` event, its own S3 key per file and its own quota charge:

| | Folders resolved | 37 multipart creates | 37 rows filed |
|---|---|---|---|
| Earlier upload | −62.76 s (03:19:49.238Z), created `pdfs` | −62.22 to −61.11 s | −60.78 to −30.55 s |
| This run | **+0.07 s** (03:20:52.063Z), reused `pdfs` | +0.22 to +1.16 s | +1.79 to +31.19 s |

03:16:13.848Z, the time first given for the earlier upload, is when the destination folder itself was created. The earlier upload's indexing stopped at −22.9 s (its 5th file's last vector), before this run started, which fits the page being reloaded between the two picks.

### This run, server side

- **Row write.** Insert start to commit (`Item.createdAt` → `file_uploaded`), every file, ms: 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 7, 8, 8, 10, 13, 14, 17, 22, 24. That covers the one statement that writes `Item`, `File`, the permission, the quota charge, the folder size and the child count.
- **Multipart complete answered → row committed:** mean **147 ms** (156 ms → 165 ms for the earlier upload). This includes the browser's next request, the server's HEAD of the stored object and the insert. `upload_transfer_completed` carries no item id, so it can't be paired per file, but the mean over the 37 is exact.
- **Row committed → metadata saved** (the page's next request), every file, ms: 43, 45, 46, 50, 53, 53, 54, 54, 55, 55, 55, 56, 58, 58, 60, 60, 63, 65, 70, 80, 85, 87, 92, 92, 97, 113, 127, 129, 131, 134, 159, 201, 203, 211, 362, 583, 1185.
- **Slow or failed requests:** none. There was no `route_request_slow` (over 1 s), no `route_request_failed` (5xx), and no `upload_refused`, `upload_aborted` or `upload_item_refused` from 03:15Z on.
- **Size, child count and quota rollup:** `ItemSizeDelta` and `QuotaDelta` were empty in all 769 samples from 03:19:40 to 03:23:00Z. Every file took the idle path, so its folder size, child count and quota charge were written in its own insert, and the rollup lag was 0 at 250 ms resolution. The 250 ms rollup never ran for these files.
- **Locks:** no sample had a backend waiting on a lock. The deadlock counter stayed at 154 and rollbacks at 1,976. The Postgres log for the window holds only checkpoints. At most 2 app backends were active at once, with 9 connections.
- **Indexing writes:**
  - Metadata was saved for 37 of 37 files, and every file has its `Pdf` facet.
  - 15 files had a text layer: their chunks were written with the metadata save, and their vectors at +45.96 to +262.75 s.
  - 22 image-only PDFs went to OCR: 302 pages, saves at +62.11 to +299.35 s. Each 12–15-page file took 14–25 s, about 2 files at a time.
  - Every one of the 37 has a `Search` row, and all 351 chunks have a vector.
  - **The last file was fully indexed at +319.87 s** (03:26:11.862Z, last chunk vector), matching the page's 319.9 s.
- **Thumbnails:** stage 2 rows for 33 of 37. The four "Stashly — Item Page*.pdf" have none, as the page also saw.

### Final consistency check (03:38Z)

| Check | Result |
|---|---|
| `pdfs` size = sum of its files | 618,494,758 = 618,494,758 ✅ (`inclusiveSize` the same) |
| `childCount` = rows | 74 = 74 ✅ |
| Quota charged once per file | `used` 4,276,025,678 → 4,894,520,436 = +618,494,758 = the 74 files, once each ✅. Two charges per file name, because the folder was uploaded twice. No other file was added to the drive in the window. |
| Delta logs drained | `ItemSizeDelta` 0, `QuotaDelta` 0 ✅ |
| This run: every file has a `Search` row with embedded chunks | 37/37, 351/351 ✅ |
| The earlier upload | 22 of 37 have **no `Search` row** (the image-only PDFs, never OCR'd); 37 chunks on 10 text-layer files **have no vector** ❌. Until re-indexed, those files can't be found by their content. |
| Document-level `Search.vector` | NULL on all 74; only chunk vectors are written. Not judged here. |

### Found along the way

- `setSearchChunkVectors` (`app/.server/search-actions.ts`, the `UPDATE "SearchChunk" … "updatedAt" = NOW()`) writes the session's local time (Asia/Jerusalem, +2 h) into a `timestamp without time zone` column, so a vector written at 03:26Z reads 05:26. Every other raw write uses `now() AT TIME ZONE 'UTC'` or a JS Date. The vector times above are corrected by −2 h. Not fixed (measure only).
- The quota now holds both copies (+618 MB). The duplicate rows and objects are still there.

### Not measured, and why

- **Server time per request** (multipart create, part signing, complete, the HEAD, `create_upload_item` as a whole): the server records a request's duration only when it passes 1 s (`route_request_slow`). Its JSON log lines go to the dev server's terminal on stdout, which can't be read without restarting the server.
- **Per-file pairing** of `upload_started`, `upload_transfer_completed` and `search_chunks_embedded` (322 events): none carries an item id. Only batch timing and exact means are given; vector times come from `SearchChunk.updatedAt`.
- **Database time inside the insert statement:** `log_min_duration_statement` and `pg_stat_statements` are off on the dev database. Insert→commit above is wall clock in the server process.

### Per file

#### This run (the 37 files filed after T0)

| # | File | Bytes | Pages | Insert start s | Insert→commit ms | Metadata saved s | Text from | Chunks with vector / all | OCR saves first→last s (pages) | Last vector s | Fully indexed s | Thumbnail row s |
|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| 1 | edge_ai.pdf | 38,507 | 3 | 1.79 | 24 | 2.18 | text layer | 2/2 | — | 46.60 | 46.60 | 599 |
| 2 | AI_Enhanced_File_Hosting.pdf | 19,153 | 2 | 2.89 | 4 | 2.94 | text layer | 1/1 | — | 45.96 | 45.96 | 500 |
| 3 | Cloud_Storage_Deep_Dive.pdf | 13,673 | 2 | 2.95 | 3 | 3.01 | text layer | 1/1 | — | 46.85 | 46.85 | 595 |
| 4 | cloud_storage_architectures.pdf | 17,358 | 4 | 3.06 | 4 | 3.10 | text layer | 2/2 | — | 47.31 | 47.31 | 589 |
| 5 | Getting Started.pdf | 72,705 | 14 | 3.44 | 4 | 3.53 | text layer | 3/3 | — | 48.00 | 48.00 | 615 |
| 6 | Foundations of Distributed Storage Architecture.pdf | 317,930 | 3 | 3.46 | 10 | 3.56 | text layer | 4/4 | — | 49.17 | 49.17 | 611 |
| 7 | Getting_Started_with_Google_Drive.pdf | 685,440 | 14 | 3.69 | 3 | 3.82 | text layer | 24/24 | — | 56.15 | 56.15 | 620 |
| 8 | Google_Workspace_Introduction.pdf | 13,299 | 2 | 3.77 | 14 | 3.90 | text layer | 2/2 | — | 54.78 | 54.78 | 624 |
| 9 | Exabyte_Architecture.pdf | 22,053,282 | 15 | 5.52 | 22 | 5.75 | OCR | 15/15 | 62.11→89.76 (15) | 295.50 | 295.50 | 606 |
| 10 | Stashly — Item Page audio.pdf | 272,512 | 1 | 6.07 | 6 | 6.21 | text layer | 1/1 | — | 57.81 | 57.81 | none |
| 11 | Smart_Edge_Heavy_Database_Architecture.pdf | 11,690,681 | 15 | 6.10 | 8 | 6.23 | OCR | 15/15 | 63.37→90.44 (15) | 295.58 | 295.58 | 629 |
| 12 | Stashly — Item Page pdf.pdf | 263,686 | 1 | 6.24 | 4 | 6.33 | text layer | 1/1 | — | 90.53 | 90.53 | none |
| 13 | Stashly — Item Page pdf2.pdf | 256,433 | 1 | 6.47 | 13 | 6.69 | text layer | 1/1 | — | 90.61 | 90.61 | none |
| 14 | Stashly — Item Page.pdf | 468,942 | 1 | 6.49 | 5 | 6.70 | text layer | 1/1 | — | 90.70 | 90.70 | none |
| 15 | Stashly-page-toolbar.pdf | 507,333 | 1 | 6.61 | 8 | 6.74 | OCR | 1/1 | 92.07→92.07 (1) | 296.66 | 296.66 | 639 |
| 16 | Stashly-page-toolbar_3.pdf | 2,710,532 | 13 | 7.57 | 5 | 7.74 | OCR | 13/13 | 93.80→117.49 (13) | 300.27 | 300.27 | 651 |
| 17 | Solar Icons Set (Vol.2) (Community).pdf | 14,305,766 | 36 | 8.48 | 17 | 9.68 | text layer | 1/1 | — | 93.95 | 93.95 | 634 |
| 18 | Stashly-page-toolbar_2.pdf | 2,710,532 | 13 | 9.20 | 6 | 9.79 | OCR | 13/13 | 95.97→120.75 (13) | 300.45 | 300.45 | 644 |
| 19 | Stashly_Architectural_Blueprint.pdf | 18,973,165 | 15 | 10.16 | 6 | 10.27 | OCR | 15/15 | 119.99→142.66 (15) | 302.94 | 302.94 | 677 |
| 20 | Stashly_Architecture_Blueprint.pdf | 14,575,890 | 14 | 12.34 | 5 | 12.40 | OCR | 14/14 | 122.04→144.13 (14) | 303.03 | 303.03 | 690 |
| 21 | Stashly_Architecture_Report.pdf | 11,404,882 | 12 | 14.07 | 4 | 14.13 | OCR | 12/12 | 144.90→161.51 (12) | 305.38 | 305.38 | 695 |
| 22 | Stashly_Architectural_Teardown.pdf | 15,753,877 | 15 | 14.38 | 4 | 14.44 | OCR | 16/16 | 145.19→166.50 (15) | 305.89 | 305.89 | 682 |
| 23 | Stashly_Architecture_Audit.pdf | 20,447,175 | 15 | 17.30 | 3 | 17.37 | OCR | 15/15 | 162.95→180.54 (15) | 307.53 | 307.53 | 687 |
| 24 | Stashly_Atomic_Upload_Architecture.pdf | 14,967,454 | 15 | 17.75 | 7 | 17.81 | OCR | 15/15 | 167.82→184.73 (15) | 307.97 | 307.97 | 699 |
| 25 | Stashly_Browser_IDE_Architecture.pdf | 14,327,434 | 15 | 17.89 | 3 | 17.94 | OCR | 15/15 | 181.98→199.19 (15) | 309.75 | 309.75 | 707 |
| 26 | Stashly_Engineering_Retrospective.pdf | 12,604,802 | 14 | 21.27 | 3 | 21.33 | OCR | 14/14 | 185.99→202.33 (14) | 310.05 | 310.05 | 745 |
| 27 | Stashly_Platform_Blueprint.pdf | 20,247,714 | 15 | 23.12 | 4 | 23.21 | OCR | 15/15 | 200.50→218.83 (15) | 312.11 | 312.11 | 750 |
| 28 | Stashly_Reference_Architecture.pdf | 15,371,041 | 13 | 24.62 | 3 | 24.68 | OCR | 13/13 | 203.66→219.40 (13) | 312.18 | 312.18 | 757 |
| 29 | Stashly_Technical_Atlas.pdf | 13,678,522 | 15 | 25.83 | 3 | 25.89 | OCR | 15/15 | 220.09→236.79 (15) | 314.19 | 314.19 | 767 |
| 30 | Stashly_System_Transformation_Blueprint.pdf | 12,328,110 | 13 | 26.39 | 4 | 26.45 | OCR | 13/13 | 220.46→234.53 (13) | 313.92 | 313.92 | 763 |
| 31 | Stashly_Technical_Blueprint.pdf | 18,339,417 | 15 | 28.58 | 5 | 28.67 | OCR | 15/15 | 236.18→257.59 (15) | 316.23 | 316.23 | 770 |
| 32 | Stashly_Technical_Debt_Audit.pdf | 12,504,051 | 14 | 28.86 | 4 | 28.92 | OCR | 14/14 | 238.19→258.03 (14) | 316.28 | 316.28 | 778 |
| 33 | Stashly_Engineering_Intelligent_Platform.pdf | 11,668,237 | 15 | 30.16 | 5 | 30.21 | OCR | 15/15 | 262.56→282.84 (15) | 318.69 | 318.69 | 743 |
| 34 | storage_architecture.pdf | 19,980 | 3 | 30.30 | 4 | 30.36 | text layer | 2/2 | — | 262.06 | 262.06 | 790 |
| 35 | system_design.pdf | 97,014 | 2 | 30.42 | 4 | 30.47 | text layer | 1/1 | — | 262.75 | 262.75 | 797 |
| 36 | Stashly_Technical_Turnaround.pdf | 12,814,620 | 15 | 30.90 | 3 | 30.96 | OCR | 16/16 | 265.29→284.46 (15) | 318.83 | 318.83 | 780 |
| 37 | Stashly_Upload_Architecture_Overhaul.pdf | 12,706,230 | 15 | 31.19 | 3 | 31.25 | OCR | 15/15 | 284.05→299.35 (15) | 319.87 | 319.87 | 787 |

#### The earlier upload (37 files filed before T0)

| # | File | Bytes | Pages | Insert start s | Insert→commit ms | Metadata saved s | Text from | Chunks with vector / all | OCR saves first→last s (pages) | Last vector s | Fully indexed s | Thumbnail row s |
|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| 1 | cloud_storage_architectures.pdf | 17,358 | 4 | -60.78 | 47 | -60.55 | text layer | 2/2 | — | -25.39 | -25.39 | 592 |
| 2 | AI_Enhanced_File_Hosting.pdf | 19,153 | 2 | -60.70 | 37 | -60.55 | text layer | 1/1 | — | -25.22 | -25.22 | 586 |
| 3 | Cloud_Storage_Deep_Dive.pdf | 13,673 | 2 | -60.62 | 6 | -60.43 | text layer | 1/1 | — | -25.04 | -25.04 | 597 |
| 4 | edge_ai.pdf | 38,507 | 3 | -60.59 | 27 | -60.42 | text layer | 2/2 | — | -24.55 | -24.55 | 602 |
| 5 | Foundations of Distributed Storage Architecture.pdf | 317,930 | 3 | -59.55 | 5 | -59.47 | text layer | 4/4 | — | -22.89 | -22.89 | 610 |
| 6 | Getting Started.pdf | 72,705 | 14 | -59.43 | 25 | -59.29 | text layer | 0/3 | — | — | **not indexed** | 617 |
| 7 | Google_Workspace_Introduction.pdf | 13,299 | 2 | -59.20 | 7 | -59.14 | text layer | 0/2 | — | — | **not indexed** | 627 |
| 8 | Getting_Started_with_Google_Drive.pdf | 685,440 | 14 | -58.65 | 5 | -58.50 | text layer | 0/24 | — | — | **not indexed** | 622 |
| 9 | Stashly — Item Page pdf.pdf | 263,686 | 1 | -56.83 | 5 | -56.72 | text layer | 0/1 | — | — | **not indexed** | none |
| 10 | Stashly — Item Page audio.pdf | 272,512 | 1 | -56.60 | 9 | -56.38 | text layer | 0/1 | — | — | **not indexed** | none |
| 11 | Stashly — Item Page pdf2.pdf | 256,433 | 1 | -56.36 | 8 | -56.17 | text layer | 0/1 | — | — | **not indexed** | none |
| 12 | Solar Icons Set (Vol.2) (Community).pdf | 14,305,766 | 36 | -56.32 | 9 | -54.74 | text layer | 0/1 | — | — | **not indexed** | 637 |
| 13 | Stashly — Item Page.pdf | 468,942 | 1 | -56.20 | 7 | -54.69 | text layer | 0/1 | — | — | **not indexed** | none |
| 14 | Stashly-page-toolbar_2.pdf | 2,710,532 | 13 | -55.80 | 5 | -54.56 | none: no `Search` row | 0/0 | — | — | **not indexed** | 647 |
| 15 | Stashly-page-toolbar.pdf | 507,333 | 1 | -54.89 | 4 | -54.54 | none: no `Search` row | 0/0 | — | — | **not indexed** | 642 |
| 16 | Smart_Edge_Heavy_Database_Architecture.pdf | 11,690,681 | 15 | -54.41 | 5 | -54.35 | none: no `Search` row | 0/0 | — | — | **not indexed** | 633 |
| 17 | Stashly-page-toolbar_3.pdf | 2,710,532 | 13 | -53.81 | 4 | -53.65 | none: no `Search` row | 0/0 | — | — | **not indexed** | 649 |
| 18 | Exabyte_Architecture.pdf | 22,053,282 | 15 | -51.18 | 3 | -51.09 | none: no `Search` row | 0/0 | — | — | **not indexed** | none |
| 19 | Stashly_Architecture_Audit.pdf | 20,447,175 | 15 | -49.51 | 3 | -49.43 | none: no `Search` row | 0/0 | — | — | **not indexed** | none |
| 20 | Stashly_Architectural_Blueprint.pdf | 18,973,165 | 15 | -47.19 | 4 | -47.12 | none: no `Search` row | 0/0 | — | — | **not indexed** | none |
| 21 | Stashly_Architectural_Teardown.pdf | 15,753,877 | 15 | -47.08 | 4 | -47.01 | none: no `Search` row | 0/0 | — | — | **not indexed** | 680 |
| 22 | Stashly_Architecture_Blueprint.pdf | 14,575,890 | 14 | -46.64 | 3 | -46.55 | none: no `Search` row | 0/0 | — | — | **not indexed** | 693 |
| 23 | Stashly_Architecture_Report.pdf | 11,404,882 | 12 | -45.21 | 3 | -45.15 | none: no `Search` row | 0/0 | — | — | **not indexed** | 698 |
| 24 | Stashly_Browser_IDE_Architecture.pdf | 14,327,434 | 15 | -43.64 | 4 | -43.56 | none: no `Search` row | 0/0 | — | — | **not indexed** | 706 |
| 25 | Stashly_Atomic_Upload_Architecture.pdf | 14,967,454 | 15 | -42.61 | 6 | -42.41 | none: no `Search` row | 0/0 | — | — | **not indexed** | 704 |
| 26 | Stashly_Engineering_Intelligent_Platform.pdf | 11,668,237 | 15 | -42.56 | 7 | -42.38 | none: no `Search` row | 0/0 | — | — | **not indexed** | 741 |
| 27 | Stashly_Engineering_Retrospective.pdf | 12,604,802 | 14 | -40.18 | 21 | -40.09 | none: no `Search` row | 0/0 | — | — | **not indexed** | 748 |
| 28 | Stashly_Platform_Blueprint.pdf | 20,247,714 | 15 | -38.87 | 17 | -38.78 | none: no `Search` row | 0/0 | — | — | **not indexed** | none |
| 29 | Stashly_Reference_Architecture.pdf | 15,371,041 | 13 | -37.43 | 3 | -37.35 | none: no `Search` row | 0/0 | — | — | **not indexed** | 755 |
| 30 | Stashly_System_Transformation_Blueprint.pdf | 12,328,110 | 13 | -36.94 | 5 | -36.84 | none: no `Search` row | 0/0 | — | — | **not indexed** | 760 |
| 31 | Stashly_Technical_Atlas.pdf | 13,678,522 | 15 | -35.57 | 3 | -35.48 | none: no `Search` row | 0/0 | — | — | **not indexed** | 766 |
| 32 | Stashly_Technical_Blueprint.pdf | 18,339,417 | 15 | -33.69 | 4 | -33.57 | none: no `Search` row | 0/0 | — | — | **not indexed** | none |
| 33 | storage_architecture.pdf | 19,980 | 3 | -33.48 | 3 | -33.39 | text layer | 0/2 | — | — | **not indexed** | 792 |
| 34 | system_design.pdf | 97,014 | 2 | -32.36 | 4 | -32.26 | text layer | 0/1 | — | — | **not indexed** | 795 |
| 35 | Stashly_Technical_Turnaround.pdf | 12,814,620 | 15 | -32.13 | 4 | -32.02 | none: no `Search` row | 0/0 | — | — | **not indexed** | 784 |
| 36 | Stashly_Technical_Debt_Audit.pdf | 12,504,051 | 14 | -32.11 | 7 | -31.98 | none: no `Search` row | 0/0 | — | — | **not indexed** | 775 |
| 37 | Stashly_Upload_Architecture_Overhaul.pdf | 12,706,230 | 15 | -30.55 | 4 | -30.45 | none: no `Search` row | 0/0 | — | — | **not indexed** | 786 |


## Appendix: part durations

Each number is one S3 part PUT in milliseconds, in part order.

- edge_ai.pdf: 934
- AI_Enhanced_File_Hosting.pdf: 2012
- Cloud_Storage_Deep_Dive.pdf: 2128
- cloud_storage_architectures.pdf: 2225
- Getting Started.pdf: 2543
- Foundations of Distributed Storage Architecture.pdf: 2597
- Getting_Started_with_Google_Drive.pdf: 2739
- Google_Workspace_Introduction.pdf: 2765
- Exabyte_Architecture.pdf: 2220, 2461, 2939, 4654, 1959
- Stashly — Item Page audio.pdf: 5053
- Smart_Edge_Heavy_Database_Architecture.pdf: 5194, 5065, 3874
- Stashly — Item Page pdf.pdf: 5298
- Stashly — Item Page pdf2.pdf: 5545
- Stashly — Item Page.pdf: 5545
- Stashly-page-toolbar.pdf: 5672
- Stashly-page-toolbar_3.pdf: 6577
- Solar Icons Set (Vol.2) (Community).pdf: 4418, 5354, 7516
- Stashly-page-toolbar_2.pdf: 8316
- Stashly_Architectural_Blueprint.pdf: 9147, 8361, 7366, 8408
- Stashly_Architecture_Blueprint.pdf: 10847, 11186, 10389
- Stashly_Architecture_Report.pdf: 12990, 12262, 11344
- Stashly_Architectural_Teardown.pdf: 9043, 12559, 13373, 8527
- Stashly_Architecture_Audit.pdf: 13830, 13885, 13869, 16238
- Stashly_Atomic_Upload_Architecture.pdf: 16311, 16286, 16641
- Stashly_Browser_IDE_Architecture.pdf: 16155, 15471, 16661
- Stashly_Engineering_Retrospective.pdf: 20102, 19876, 17382
- Stashly_Platform_Blueprint.pdf: 19696, 19346, 21241, 21932
- Stashly_Reference_Architecture.pdf: 22268, 22571, 23412
- Stashly_Technical_Atlas.pdf: 22933, 24521, 23731
- Stashly_System_Transformation_Blueprint.pdf: 25075, 24668, 24430
- Stashly_Technical_Blueprint.pdf: 26051, 27280, 26995, 25558
- Stashly_Technical_Debt_Audit.pdf: 27541, 27493, 27131
- Stashly_Engineering_Intelligent_Platform.pdf: 29007, 19539, 16903
- storage_architecture.pdf: 28857
- system_design.pdf: 28978
- Stashly_Technical_Turnaround.pdf: 29516, 29581, 28568
- Stashly_Upload_Architecture_Overhaul.pdf: 29519, 29795, 29582

Part durations are long (up to 29.8 s for a part) while all 84 parts were in flight together; the likely reason is that they shared the uplink, but that was not tested, and a part's duration is not the speed of one connection.
