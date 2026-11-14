# Upload of `X:\pdfs` — live measurement, run 1 (14 Nov 2026)

One real folder upload, measured in the browser from the moment the folder was chosen until nothing was left to do. All numbers come from a recorder injected into the page; nothing is estimated unless it says so. Times are seconds after **T0**.

- **T0:** 2026-11-14T03:20:51.993Z — the `change` event of the folder input (`<input webkitdirectory>`, "New and upload → Folders"), picked by the owner in the in-app browser pane.
- **Folder:** `X:\pdfs`, 37 PDFs, 309,247,379 bytes (295 MB), flat. Filed into one new subfolder `pdfs` inside the destination folder.
- **Account:** `usr_jY94r4AQIyrd9N0xPPME5Q`. **Destination folder:** `item_vMhZtZXhSx-4mO4Jypifrw` ("Upload measurement 14 Nov (test)"). Subfolder `pdfs`: `item__33YiIlb34ojjh6ph2Ft3w`.
- **Machine:** Windows 11, NVIDIA Turing GPU (WebGPU on), 16 logical cores, dev server on :80 (Vite dev mode, not a production build), Tigris storage.
- **Product code:** unchanged. The recorder (wrappers around `fetch` and the `Worker` constructor, a long-task observer, a 25 ms loop-lag timer) lived only in the page.

## Read this first: what limits these numbers

1. **The destination folder was not clean.** The `pdfs` folder holds **74 files, not 37**. 37 of them (the same file names) were created at about **T0 − 278 s (≈03:16:13Z)** by an upload this recorder did not see, apparently the owner's first attempt. The recorder counts only this page's own requests and every per-file row below is keyed by item id, so the browser-side figures are this run's alone. **Server-side figures for 03:16:13Z–03:26:12Z cover two uploads**, and any total taken from the folder (74 items, 618 MB) is double. Embedding saves cannot be attributed to a file by id.
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

The 61 thumbnails include the first upload's items that were also on screen, so only 33 of them are this run's files.
Request durations: `create_upload_item` 111–216 ms · `save_media_metadata` 16–114 ms · `save_ocr_page` 19–189 ms · `save_search_chunk_embeddings` 19–300 ms.
OCR and embedding saves per 30 s (OCR / embedding): 30 s 0/9 · 60 s 29/0 · 90 s 28/4 · 120 s 37/0 · 150 s 44/0 · 180 s 47/0 · 210 s 48/0 · 240 s 33/2 · 270 s 36/50 · 300 s 0/252.

## Main thread, workers, errors

- **Long tasks (≥ 50 ms) and loop lag (> 150 ms) during the upload and indexing phases:** one of each, at T0 + 0.1 s (410 ms long task, 424 ms lag) when the folder was handed over. Nothing else until the thumbnail phase.
- **During the thumbnail phase (my navigation and scrolling):** 352 ms long task and 378 ms lag at 499.2 s (opening the folder); 190 ms and 58 ms long tasks and a 182 ms lag at 736.7–737.3 s.
- Before T0 the page logged timer gaps of about 1 s while the pane was hidden; those samples are excluded.
- **Workers started (page `new Worker`):** hash 0.1 s · thumbnail compute 1.8 s · embedding 33.1 s · PaddleOCR 56.1 s · embedding again 258 s.
- Console errors and warnings: none. Failed requests: none. Retried part PUTs: none (84 PUTs, no part repeated).

## Left over

A probe after the run, `GET /api/items?intent=pending_search_embeddings`, answered **37 chunks** still waiting for a vector, account-wide. The response carries no item id, so I cannot say whether they belong to this run, the earlier upload or older files. Counting `SearchChunk` rows with a null vector for the 74 items would settle it.

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
