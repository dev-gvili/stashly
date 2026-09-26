-- Phase 1 of retiring the `Thumbnail.url` locator: additive only, so the code
-- that still reads `url` keeps working while this is deployed.
--
-- `url` packs three formats into one column: an `s3://{bucket}/{key}?v={stage}`
-- locator, a legacy `https://{bucket}.t3.tigrisfiles.io/{key}?v={stage}` public
-- URL, and a `#hex` stage-0 placeholder. The key is always
-- `thumbnails/{itemId}.webp` and `?v` always equals `stage`, so the only real
-- information is the bucket — which gets its own column, as does the colour.

-- AlterTable
ALTER TABLE "Thumbnail" ADD COLUMN "bucket" TEXT,
ADD COLUMN "color" TEXT;

-- Backfill
UPDATE "Thumbnail" SET "color" = "url" WHERE "url" LIKE '#%';

UPDATE "Thumbnail"
SET "bucket" = substring("url" from '^s3://([^/]+)/')
WHERE "url" LIKE 's3://%';

UPDATE "Thumbnail"
SET "bucket" = substring("url" from '^https://([^.]+)\.t3\.tigrisfiles\.io/')
WHERE "url" LIKE 'https://%.t3.tigrisfiles.io/%';

-- CreateIndex
-- Restores the index added in 20260424160000 and dropped as a side effect of
-- 20260526182115. Fails if duplicate (itemId, view, size) rows exist — check
-- first on any database that ran without it.
CREATE UNIQUE INDEX "Thumbnail_itemId_view_size_key" ON "Thumbnail"("itemId", "view", "size");
