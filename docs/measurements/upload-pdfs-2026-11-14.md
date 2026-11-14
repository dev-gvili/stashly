# Upload of `X:\pdfs` — live measurement, run 1 and run 2 (14 Nov 2026)

Run 1 is below (folder chosen until everything was indexed); run 2 is its own section ("Run 2", folder chosen until the last item row was created). Backend Dev's server-side section follows. The text that follows describes run 1.

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

## Run 2 (browser side): folder chosen until the last item row is created

Scope set by the owner for this run: from T0 to the moment the last `create_upload_item` was answered. Thumbnails, OCR and embeddings are not measured here (they run after this window). Same recorder, same page, same machine and account as run 1.

- **T0:** 2026-11-14T03:56:43.708Z. **Exactly one pick**: the recorder logged one file-input `change` (37 files, 309,247,379 bytes, `webkitdirectory`), no drop, no second pick.
- **End:** last `create_upload_item` answered at **T0 + 32.37 s = 03:57:16.081Z**.
- **Destination:** fresh empty folder `item_BN9Cbvn_6EtIOQtVfOoB5w` ("Upload measurement 14 Nov run 2 (test)"), account `usr_jY94r4AQIyrd9N0xPPME5Q`. I did not touch the page during the run; the folder page was open throughout.
- **Pane in view and the page visible** for the whole run.

### Batch, run 2 (compare run 1 in brackets)

| Measure | Run 2 | Run 1 |
|---|---|---|
| Quota pre-check (`POST /api/quota`) | sent T0 + 0.00 s, 60 ms, 200 | 1 call |
| `resolve_upload_folders` (1 call) | T0 + 0.07 s, 136 ms, 200 | 1 call |
| `pdfs` folder card inserted on the page | T0 + 0.24 s | not recorded |
| `create-multipart-upload` (37) | first sent 0.21 s, last answered 1.61 s; 392–1,100 ms each | 0.1–1.2 s |
| First part PUT started / last part PUT finished | 0.62 s / 32.01 s | 0.5 s / 30.9 s |
| Part PUTs | 84, all 200, none repeated | 84, all 200 |
| Peak part PUTs in flight | 83 at T0 + 1.64 s | 84 at 1.2 s |
| Peak files uploading at once | 37 | 37 |
| Average transfer (309,247,379 B over the PUT window) | 9.85 MB/s | 10.17 MB/s |
| `complete-multipart-upload` (37) | first 1.37 s, last answered 32.19 s; 139–270 ms each | 1.5–31.1 s |
| `create_upload_item` (37) | first answered 1.9 s, **last answered 32.37 s**; 108–337 ms each | 1.8–31.3 s; 111–216 ms |
| `save_media_metadata` in this window (it starts as rows appear) | 36 sent, first at 3.6 s, last answered 31.67 s; 15–68 ms each | 37, 2.1–31.3 s |
| Long tasks (≥ 50 ms) / loop lag (> 150 ms) in the window | one each, at T0 + 0.2 s: 325 ms long task, 338 ms lag | one each at 0.1 s: 410 ms, 424 ms |
| Workers started | hash 0.2 s, thumbnail compute 1.92 s | same |
| Errors, non-2xx, retries, console messages | none | none |

MB finished per 5 s window (by part completion): 0–5 s 27.0 · 5–10 s 43.1 · 10–15 s 51.7 · 15–20 s 53.6 · 20–25 s 69.1 · 25–30 s 41.5 · 30–32 s 23.2 (about 5.4, 8.6, 10.3, 10.7, 13.8, 8.3 MB/s; last window partial).

Requests in the window: 84 S3 part PUTs, 37 create-multipart, 37 complete-multipart, 37 `create_upload_item`, 36 `save_media_metadata`, 1 `resolve_upload_folders`, 1 quota check, 3 `GET /api/notifications` (the app's own poll) — 236 in all.

Not measured: server time per request (Backend Dev's section), the S3 side of each part.

### Per file, run 2 (all 37)

Times in seconds after T0. CM = `create-multipart-upload` sent–answered; PUTs = first part start–last part end; Complete = `complete-multipart-upload` sent–answered; Item = `create_upload_item` sent–answered. Every request answered 200.

| # | File | MB | Parts | CM s | PUTs s | Part durations (ms) | Complete s | Item s |
|---|---|---|---|---|---|---|---|---|
| 1 | Cloud_Storage_Deep_Dive.pdf | 0.01 | 1 | 0.3–0.7 | 0.7–1.4 | 707 | 1.4–1.6 | 1.7–1.9 |
| 2 | AI_Enhanced_File_Hosting.pdf | 0.02 | 1 | 0.2–0.6 | 0.6–1.6 | 1021 | 1.6–1.8 | 1.8–2.2 |
| 3 | cloud_storage_architectures.pdf | 0.02 | 1 | 0.2–0.7 | 0.7–2.2 | 1494 | 2.2–2.4 | 2.4–2.6 |
| 4 | edge_ai.pdf | 0.04 | 1 | 0.3–0.7 | 0.7–2.5 | 1854 | 2.5–2.8 | 2.8–2.9 |
| 5 | Foundations of Distributed Storage Architecture.pdf | 0.32 | 1 | 0.3–0.7 | 0.7–3.0 | 2270 | 3.0–3.2 | 3.2–3.3 |
| 6 | Getting Started.pdf | 0.07 | 1 | 0.3–0.8 | 0.8–3.1 | 2325 | 3.1–3.3 | 3.3–3.5 |
| 7 | Getting_Started_with_Google_Drive.pdf | 0.69 | 1 | 0.3–0.8 | 0.8–3.7 | 2911 | 3.7–3.9 | 3.9–4.0 |
| 8 | Exabyte_Architecture.pdf | 22.05 | 5 | 0.3–0.7 | 0.7–4.8 | 2415, 3023, 2639, 4081, 2206 | 4.8–4.9 | 4.9–5.1 |
| 9 | Google_Workspace_Introduction.pdf | 0.01 | 1 | 0.3–0.9 | 0.9–5.8 | 4841 | 5.8–5.9 | 5.9–6.1 |
| 10 | Stashly — Item Page pdf.pdf | 0.26 | 1 | 0.4–0.9 | 0.9–6.0 | 5027 | 6.0–6.1 | 6.1–6.2 |
| 11 | Solar Icons Set (Vol.2) (Community).pdf | 14.31 | 3 | 0.3–0.9 | 0.9–6.0 | 4695, 5089, 4061 | 6.0–6.1 | 6.1–6.3 |
| 12 | Stashly — Item Page pdf2.pdf | 0.26 | 1 | 0.4–1.0 | 1.0–6.0 | 5015 | 6.0–6.2 | 6.2–6.3 |
| 13 | Stashly — Item Page audio.pdf | 0.27 | 1 | 0.3–0.9 | 0.9–6.1 | 5137 | 6.1–6.2 | 6.2–6.3 |
| 14 | Stashly-page-toolbar.pdf | 0.51 | 1 | 0.4–1.0 | 1.0–6.7 | 5626 | 6.7–6.8 | 6.8–7.0 |
| 15 | Stashly — Item Page.pdf | 0.47 | 1 | 0.4–1.0 | 1.0–7.1 | 6086 | 7.1–7.3 | 7.3–7.4 |
| 16 | Stashly-page-toolbar_3.pdf | 2.71 | 1 | 0.4–1.0 | 1.1–8.0 | 6987 | 8.0–8.2 | 8.2–8.3 |
| 17 | Stashly-page-toolbar_2.pdf | 2.71 | 1 | 0.4–1.1 | 1.1–8.7 | 7668 | 8.7–8.9 | 8.9–9.0 |
| 18 | Smart_Edge_Heavy_Database_Architecture.pdf | 11.69 | 3 | 0.3–0.9 | 0.9–9.1 | 6519, 8224, 4792 | 9.1–9.3 | 9.3–9.4 |
| 19 | Stashly_Architectural_Blueprint.pdf | 18.97 | 4 | 0.4–1.1 | 1.1–10.8 | 8002, 8600, 9691, 8294 | 10.8–11.0 | 11.0–11.1 |
| 20 | Stashly_Architectural_Teardown.pdf | 15.75 | 4 | 0.4–1.2 | 1.2–12.6 | 10690, 10189, 11432, 8353 | 12.6–12.8 | 12.8–12.9 |
| 21 | Stashly_Architecture_Audit.pdf | 20.45 | 4 | 0.4–1.2 | 1.2–13.7 | 10559, 10922, 12567, 12105 | 13.7–13.9 | 13.9–14.1 |
| 22 | Stashly_Architecture_Blueprint.pdf | 14.58 | 3 | 0.4–1.2 | 1.2–15.0 | 13100, 13825, 13166 | 15.0–15.2 | 15.2–15.3 |
| 23 | Stashly_Architecture_Report.pdf | 11.40 | 3 | 0.4–1.2 | 1.2–15.2 | 13937, 14026, 13158 | 15.2–15.4 | 15.4–15.5 |
| 24 | Stashly_Atomic_Upload_Architecture.pdf | 14.97 | 3 | 0.5–1.2 | 1.2–17.4 | 16089, 16213, 15911 | 17.4–17.6 | 17.6–17.7 |
| 25 | Stashly_Engineering_Intelligent_Platform.pdf | 11.67 | 3 | 0.5–1.3 | 1.3–18.6 | 17241, 15849, 14408 | 18.6–18.7 | 18.8–18.9 |
| 26 | Stashly_Browser_IDE_Architecture.pdf | 14.33 | 3 | 0.5–1.3 | 1.3–21.1 | 16306, 19820, 17325 | 21.1–21.3 | 21.3–21.4 |
| 27 | Stashly_Engineering_Retrospective.pdf | 12.60 | 3 | 0.5–1.3 | 1.3–21.3 | 19564, 19939, 17226 | 21.3–21.4 | 21.4–21.5 |
| 28 | Stashly_Platform_Blueprint.pdf | 20.25 | 4 | 0.5–1.3 | 1.3–22.5 | 21139, 19321, 19437, 20997 | 22.5–22.6 | 22.6–22.8 |
| 29 | Stashly_Reference_Architecture.pdf | 15.37 | 3 | 0.5–1.4 | 1.4–24.4 | 21369, 22827, 23036 | 24.4–24.6 | 24.6–24.7 |
| 30 | Stashly_Technical_Debt_Audit.pdf | 12.50 | 3 | 0.5–1.5 | 1.5–24.6 | 23122, 22785, 22452 | 24.6–24.7 | 24.8–24.9 |
| 31 | Stashly_Technical_Atlas.pdf | 13.68 | 3 | 0.5–1.5 | 1.5–27.2 | 23300, 25757, 24689 | 27.2–27.4 | 27.4–27.5 |
| 32 | Stashly_Technical_Blueprint.pdf | 18.34 | 4 | 0.5–1.5 | 1.5–27.7 | 25063, 26118, 26240, 24438 | 27.7–27.9 | 27.9–28.1 |
| 33 | storage_architecture.pdf | 0.02 | 1 | 0.5–1.6 | 1.6–27.9 | 26286 | 27.9–28.1 | 28.1–28.3 |
| 34 | system_design.pdf | 0.10 | 1 | 0.5–1.6 | 1.6–28.1 | 26496 | 28.1–28.3 | 28.3–28.5 |
| 35 | Stashly_System_Transformation_Blueprint.pdf | 12.33 | 3 | 0.5–1.5 | 1.5–29.6 | 27118, 28109, 25926 | 29.6–29.8 | 29.8–30.0 |
| 36 | Stashly_Technical_Turnaround.pdf | 12.81 | 3 | 0.5–1.5 | 1.5–31.3 | 29762, 29018, 27978 | 31.3–31.5 | 31.5–31.6 |
| 37 | Stashly_Upload_Architecture_Overhaul.pdf | 12.71 | 3 | 0.5–1.6 | 1.6–32.0 | 30101, 30373, 29672 | 32.0–32.2 | 32.2–32.4 |

Reading it: files finish in an order set by when their parts finish, not by file size; the small files sit in the batch behind the big ones' bandwidth (a 13 KB file took 4.8 s to put in row 9, and a 20 KB file 26 s in row 33), because every part in flight shares the uplink. That is a reading of the numbers, not a separate test. One run each: run 1 and run 2 differ by about 3% on average throughput (10.17 and 9.85 MB/s) and on the end of the last item (31.3 s and 32.4 s).

## Server and database side, run 1 (Backend Dev)

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


## Server and database side, run 2 (Backend Dev)

Scope set by the owner for run 2: from T0 to the last file's row committed (`file_uploaded`). Thumbnails, OCR, embeddings and indexing are left out. Times are seconds after run 2's **T0 = 2026-11-14T03:56:43.708Z** (Frontend's folder pick). Measured read-only, like run 1: `Item.createdAt`, Vinktar events, the Postgres log, and a sampler polling the database every 250 ms from 03:52:16Z (192 samples between 03:56:40 and 03:57:30Z, 6–14 ms each). The same server, `X:\stashly` at `e8a5f82` in dev mode.

- **Account:** `usr_jY94r4AQIyrd9N0xPPME5Q`, on the same drive as run 1.
- **Destination folder:** `item_BN9Cbvn_6EtIOQtVfOoB5w`, new and empty. The upload filed into a new `pdfs` subfolder, `item_MSPT3kATpAAuXuX6xokfSQ`, created 03:56:43.793Z.
- **The drive before the run:** the owner had emptied it at 03:46Z on purpose, so it held 0 files and quota `used` was 0.
- **One pick:** a single `upload_folders_resolved` event, 37 rows for 37 distinct names, and every event came from the pane's browser.

### Batch timeline (server events)

| Event | Time |
|---|---|
| Folder tree resolved (`upload_folders_resolved`, 1 folder created) | 0.113 s |
| 37 multipart creates answered (`upload_started`) | 0.612 – 1.605 s |
| First multipart complete answered (`upload_transfer_completed`) | 1.620 s |
| First row insert start / first row committed | 1.812 s / 1.886 s |
| Last multipart complete answered | 32.186 s |
| Last row insert start / **last row committed** (end of scope) | 32.359 s / **32.363 s** |

Cross-check with the browser: the page saw the last `create_upload_item` answered at +32.37 s (03:57:16.081Z), 10 ms after the server sent `file_uploaded` for that row (03:57:16.071Z).

### Per file

- **Row write, every file:** insert start to commit (`Item.createdAt` → `file_uploaded`), in ms: 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 7, 16, 17, 18, 26, 28, 74. Each is one statement that writes `Item`, `File`, the permission, the quota charge, the folder size and the child count.
- **Multipart complete answered → row committed:** mean **147 ms**, with **139 ms** of it before the insert starts. That 139 ms is the browser's next request plus the server's HEAD of the stored object. Run 1 measured the same 147 / 140 ms. These events carry no item id, so they can't be paired per file; the means over all 37 are exact.
- **Not separable without instrumentation:** the HEAD on its own, multipart create, part signing and complete as server time per request. The server only times requests over 1 s, and its log lines go to the dev server's terminal.

### Slow or failed requests, rollup, locks

- **Requests:** 0 `route_request_slow` (over 1 s), 0 `route_request_failed`, 0 `upload_refused`, `upload_aborted` or `upload_item_refused`, 03:56:30–03:57:40Z.
- **Size, child count and quota rollup:** `ItemSizeDelta` and `QuotaDelta` were empty in all 192 samples. Every file took the idle path, so its folder size, child count and quota charge were written by its own insert, and rollup lag was 0 at 250 ms resolution. In every sample, quota `used` equalled the sum of the files filed so far.
- **Locks:** no sample had a backend waiting on a lock. The deadlock counter stayed at 154 and rollbacks at 1,977. At most 2 app backends were active at once, with 7 connections. The Postgres log for the run (03:56:43–03:57:17Z) has only a checkpoint. After the run, at 03:57:36Z, it logs one `ERROR` and two `could not receive data from client` lines. All three are mine: a malformed read-only query of my own, and my samplers disconnecting when I stopped them.

### Consistency at the end

| Check | Result |
|---|---|
| `pdfs` size = sum of its files | 309,247,379 = 309,247,379 ✅ (`inclusiveSize` the same; destination folder size 309,247,379) |
| `childCount` = rows | 37 = 37 ✅ (destination `childCount` 1) |
| Quota charged once per file | `used` 0 → 309,247,379 = the 37 files once ✅. The drive holds exactly these 37 files. |
| Delta logs drained | `ItemSizeDelta` 0, `QuotaDelta` 0 ✅ |
| Duplicates | 37 rows, 37 names, no second pick ✅ |

### Run 1 and run 2 side by side (server, to the last row committed)

| | Run 1 (measured pick) | Run 2 |
|---|---|---|
| Folders resolved | +0.070 s | +0.113 s |
| Multipart creates answered | +0.22 to +1.16 s | +0.61 to +1.61 s |
| First / last row committed | +1.89 s / +31.19 s | +1.89 s / +32.36 s |
| Insert→commit, range | 3–24 ms | 2–74 ms |
| Complete → committed, mean | 147 ms | 147 ms |
| Slow / failed / refused requests | 0 / 0 / 0 | 0 / 0 / 0 |
| Delta logs used, lock waits, new deadlocks | none / 0 / 0 | none / 0 / 0 |
| Quota charged | once per file (plus the earlier pick's 37) | once per file, exactly |

#### Run 2, every file

| # | File | Bytes | Row insert start s | Row committed s | Insert→commit ms |
|---|---|---:|---:|---:|---:|
| 1 | Cloud_Storage_Deep_Dive.pdf | 13,673 | 1.812 | 1.886 | 74 |
| 2 | AI_Enhanced_File_Hosting.pdf | 19,153 | 2.145 | 2.171 | 26 |
| 3 | cloud_storage_architectures.pdf | 17,358 | 2.577 | 2.582 | 5 |
| 4 | edge_ai.pdf | 38,507 | 2.909 | 2.915 | 6 |
| 5 | Foundations of Distributed Storage Architecture.pdf | 317,930 | 3.286 | 3.291 | 5 |
| 6 | Getting Started.pdf | 72,705 | 3.442 | 3.446 | 4 |
| 7 | Getting_Started_with_Google_Drive.pdf | 685,440 | 4.032 | 4.036 | 4 |
| 8 | Exabyte_Architecture.pdf | 22,053,282 | 5.027 | 5.045 | 18 |
| 9 | Google_Workspace_Introduction.pdf | 13,299 | 6.029 | 6.034 | 5 |
| 10 | Stashly — Item Page pdf.pdf | 263,686 | 6.221 | 6.226 | 5 |
| 11 | Solar Icons Set (Vol.2) (Community).pdf | 14,305,766 | 6.223 | 6.240 | 17 |
| 12 | Stashly — Item Page pdf2.pdf | 256,433 | 6.270 | 6.286 | 16 |
| 13 | Stashly — Item Page audio.pdf | 272,512 | 6.331 | 6.336 | 5 |
| 14 | Stashly-page-toolbar.pdf | 507,333 | 6.943 | 6.948 | 5 |
| 15 | Stashly — Item Page.pdf | 468,942 | 7.403 | 7.406 | 3 |
| 16 | Stashly-page-toolbar_3.pdf | 2,710,532 | 8.314 | 8.320 | 6 |
| 17 | Stashly-page-toolbar_2.pdf | 2,710,532 | 8.984 | 8.988 | 4 |
| 18 | Smart_Edge_Heavy_Database_Architecture.pdf | 11,690,681 | 9.423 | 9.427 | 4 |
| 19 | Stashly_Architectural_Blueprint.pdf | 18,973,165 | 11.066 | 11.071 | 5 |
| 20 | Stashly_Architectural_Teardown.pdf | 15,753,877 | 12.885 | 12.888 | 3 |
| 21 | Stashly_Architecture_Audit.pdf | 20,447,175 | 14.067 | 14.073 | 6 |
| 22 | Stashly_Architecture_Blueprint.pdf | 14,575,890 | 15.274 | 15.278 | 4 |
| 23 | Stashly_Architecture_Report.pdf | 11,404,882 | 15.508 | 15.511 | 3 |
| 24 | Stashly_Atomic_Upload_Architecture.pdf | 14,967,454 | 17.724 | 17.726 | 2 |
| 25 | Stashly_Engineering_Intelligent_Platform.pdf | 11,668,237 | 18.868 | 18.871 | 3 |
| 26 | Stashly_Browser_IDE_Architecture.pdf | 14,327,434 | 21.420 | 21.427 | 7 |
| 27 | Stashly_Engineering_Retrospective.pdf | 12,604,802 | 21.532 | 21.535 | 3 |
| 28 | Stashly_Platform_Blueprint.pdf | 20,247,714 | 22.748 | 22.776 | 28 |
| 29 | Stashly_Reference_Architecture.pdf | 15,371,041 | 24.712 | 24.715 | 3 |
| 30 | Stashly_Technical_Debt_Audit.pdf | 12,504,051 | 24.872 | 24.878 | 6 |
| 31 | Stashly_Technical_Atlas.pdf | 13,678,522 | 27.493 | 27.496 | 3 |
| 32 | Stashly_Technical_Blueprint.pdf | 18,339,417 | 28.094 | 28.098 | 4 |
| 33 | storage_architecture.pdf | 19,980 | 28.319 | 28.322 | 3 |
| 34 | system_design.pdf | 97,014 | 28.489 | 28.493 | 4 |
| 35 | Stashly_System_Transformation_Blueprint.pdf | 12,328,110 | 29.953 | 29.957 | 4 |
| 36 | Stashly_Technical_Turnaround.pdf | 12,814,620 | 31.596 | 31.601 | 5 |
| 37 | Stashly_Upload_Architecture_Overhaul.pdf | 12,706,230 | 32.359 | 32.363 | 4 |

## Raw uplink to Tigris

**Question (owner):** both app runs moved the 309,247,379 B in about 31 s (9.85–10.17 MB/s). Is that this machine's uplink to Tigris, or the app's scheduling?

**Answer:** it is mostly the uplink. Outside the app, the same bytes in the same 5 MiB parts never went faster than **11.63 MB/s** (93 Mbit/s). The rate stops rising between 16 and 32 parts in flight:
- 32 in flight averaged 11.55 MB/s and 84 averaged 11.54 MB/s. **Sending all 84 at once is not slower than a smaller window.**
- At the best setting the batch's parts take **26.6–27.0 s** (27.0–27.8 s with create and complete), against about 31 s in the app.
- So the app reaches 85–88% of what this line carries to Tigris. About 3.5–4 s, 12–15%, is spent above the raw transfer.

**How it was measured** (Backend Dev, 14 Nov, 04:37–04:46Z, run after run 2 with nothing else uploading):
- **The script:** a Node script outside the app, in the session's scratchpad, not the repo. It uses the AWS SDK with `app/.server/s3.ts`'s settings: endpoint host `fly.storage.tigris.dev`, region `auto`, `requestChecksumCalculation: 'WHEN_REQUIRED'`, credentials from `.env`.
- **Connections:** HTTPS/1.1 keep-alive with up to 256 sockets, so the client never capped concurrency. SDK retries were off, so any failure would show.
- **The payload:** all 37 files of `X:\pdfs`, read into memory first so disk reads were not timed, and split exactly as the app splits them: **84 parts** of 5 MiB (the last part of each file shorter).
- **Each run:** a `CreateMultipartUpload` per file, then all 84 `UploadPart`s through a pool of N workers, then `CompleteMultipartUpload` per file.
- **Run order:** two rounds, each going from 84 down to 1 in flight, so a slow minute on the line would show up as a round difference rather than skewing one setting.
- **Where the objects went:** bucket `stashly-alongvili-j0o60njo` (the dev account's), under the scratch prefix `uplink-test-2026-11-14/`. Each run's objects were deleted right after it.
- **Cleanup check:** at the end the prefix held 0 objects and 0 open multipart uploads.

**Columns:**
- **Parts wall:** first part sent → last part answered.
- **MB/s (parts):** 309,247,379 B divided by that time.
- **Total:** first create → last complete.
- **Part ms:** each part's request time.

### Every run

| Parts in flight | Round | Started (UTC) | Parts wall s | MB/s (parts) | Total s (create→complete) | MB/s (total) | Part ms p50 / p90 / max (min) | Errors |
|---:|---:|---|---:|---:|---:|---:|---|---:|
| 1 | 1 | 04:40:10 | 45.44 | **6.81** | 45.76 | 6.76 | 583 / 646 / 3131 (121) | 0 |
| 1 | 2 | 04:44:43 | 46.45 | **6.66** | 46.77 | 6.61 | 579 / 710 / 2211 (119) | 0 |
| 2 | 1 | 04:39:31 | 37.64 | **8.22** | 37.97 | 8.15 | 919 / 1319 / 4493 (126) | 0 |
| 2 | 2 | 04:44:06 | 36.44 | **8.49** | 36.75 | 8.41 | 1027 / 1236 / 4042 (118) | 0 |
| 4 | 1 | 04:38:58 | 32.23 | **9.60** | 32.52 | 9.51 | 1589 / 2545 / 4923 (123) | 0 |
| 4 | 2 | 04:43:32 | 33.11 | **9.34** | 33.45 | 9.25 | 1467 / 3026 / 5611 (119) | 0 |
| 8 | 1 | 04:38:28 | 29.76 | **10.39** | 30.09 | 10.28 | 3039 / 4489 / 6924 (121) | 0 |
| 8 | 2 | 04:43:02 | 28.90 | **10.70** | 29.22 | 10.58 | 3013 / 4549 / 6190 (139) | 0 |
| 16 | 1 | 04:37:59 | 27.59 | **11.21** | 27.90 | 11.08 | 5505 / 8467 / 10557 (146) | 0 |
| 16 | 2 | 04:42:33 | 29.00 | **10.66** | 29.32 | 10.55 | 5466 / 8799 / 10122 (115) | 0 |
| 32 | 1 | 04:37:32 | 26.59 | **11.63** | 26.92 | 11.49 | 10864 / 14981 / 18414 (125) | 0 |
| 32 | 2 | 04:42:05 | 26.95 | **11.47** | 27.26 | 11.34 | 10212 / 15320 / 18345 (137) | 0 |
| 84 | 1 | 04:37:03 | 26.94 | **11.48** | 27.84 | 11.11 | 24118 / 26216 / 26935 (1026) | 0 |
| 84 | 2 | 04:41:37 | 26.65 | **11.60** | 26.96 | 11.47 | 23707 / 25804 / 26641 (1026) | 0 |

| Single-stream PUT | Round | Bytes | Seconds | MB/s | Error |
|---|---:|---:|---:|---:|---|
| Largest file (Exabyte_Architecture.pdf) | 1 | 22,053,282 | 2.92 | 7.56 | none |
| All 37 files as one object | 1 | 309,247,379 | 39.17 | 7.90 | none |
| Largest file (Exabyte_Architecture.pdf) | 2 | 22,053,282 | 2.22 | 9.93 | none |
| All 37 files as one object | 2 | 309,247,379 | 38.68 | 8.00 | none |

| Parts in flight | Mean MB/s (2 runs) |
|---:|---:|
| 1 | 6.73 (6.81, 6.66) |
| 2 | 8.36 (8.22, 8.49) |
| 4 | 9.47 (9.60, 9.34) |
| 8 | 10.54 (10.39, 10.70) |
| 16 | 10.94 (11.21, 10.66) |
| 32 | 11.55 (11.63, 11.47) |
| 84 | 11.54 (11.48, 11.60) |

### Reading it

- **Concurrency stops paying at 16–32 parts in flight.**
  - Going from 1 to 8 in flight raises the rate from 6.73 to 10.54 MB/s.
  - 16 gives 10.94, 32 gives 11.55, and 84 gives 11.54.
  - The 84-at-once runs are within 0.15 MB/s of the 32 runs, inside the run-to-run spread, so the app's choice of sending every part at once costs nothing measurable here.
- **Why single parts take 24–27 s at 84 in flight.** Each part's time grows with the window because all parts share one line: p50 is 0.58 s at 1 in flight, 3.0 s at 8, 10–11 s at 32 and 24 s at 84. The 30 s parts the app saw are this sharing, not a stuck request. The first 84 run's 0.7 s create step (0.13–0.15 s in every later run) includes opening the first connections.
- **A single stream is slower than parallel parts:** one 309 MB `PutObject` took 38.7–39.2 s (7.90–8.00 MB/s), and one 22 MB `PutObject` 2.2–2.9 s (7.56–9.93 MB/s).
- **One part at a time:** a full 5 MiB part takes about 0.58 s (≈ 9 MB/s while it runs). The short final parts take 0.12–0.15 s each, mostly request overhead, which is why 1 in flight averages only 6.73 MB/s.
- **The X:\pdfs batch at the best setting** (32 or 84 parts in flight): **26.6–27.0 s** to move the parts, 27.0–27.8 s from the first create to the last complete. That is the floor for these bytes on this line today.
- **The app, for comparison** (from the sections above): about 30.4 s of part transfer in run 1 (10.17 MB/s), and its last multipart complete answered at +32.19 s in run 2.

### Not measured

- **The browser's own connection.** These runs used Node over HTTP/1.1. Whether Chrome reached Tigris over HTTP/1.1 or HTTP/2, and how many connections it used, would need the browser's network log. That is the most likely place for the app's extra 3.5–4 s, but it is not proven here.
- **Other times of day and other lines.** All 18 runs (14 multipart, 4 single PUTs) ran within 9 minutes (04:37–04:46Z) on this machine's connection.
- **Where requests landed.** The endpoint is Tigris's global `fly.storage.tigris.dev`; which region served them wasn't recorded.
- **Other part sizes.** Only 5 MiB parts were tried, matching the app.

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
