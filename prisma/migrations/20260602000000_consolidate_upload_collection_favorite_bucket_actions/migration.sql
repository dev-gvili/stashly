-- Consolidated migration: captures the pre-existing UploadAction drift
-- (which was applied to the dev DB via `prisma db push` before any
-- migration was authored) along with the new CollectionAction /
-- FavoriteAction / BucketAction action types and their links from
-- ItemAction. Mirrors the schema state at app/prisma/models/action.prisma
-- as of 2026-06-02.

-- ─── Enums ─────────────────────────────────────────────────────────────────

CREATE TYPE "CollectionActionKind" AS ENUM ('item_added', 'item_removed', 'emptied');

CREATE TYPE "FavoriteKind" AS ENUM ('favorited', 'unfavorited');

CREATE TYPE "BucketKind" AS ENUM ('emptied');

-- ─── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE "UploadAction" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    CONSTRAINT "UploadAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollectionAction" (
    "id" TEXT NOT NULL,
    "kind" "CollectionActionKind" NOT NULL,
    "collectionId" TEXT,
    "itemId" TEXT,
    "count" INTEGER,
    CONSTRAINT "CollectionAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FavoriteAction" (
    "id" TEXT NOT NULL,
    "kind" "FavoriteKind" NOT NULL,
    CONSTRAINT "FavoriteAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BucketAction" (
    "id" TEXT NOT NULL,
    "kind" "BucketKind" NOT NULL,
    CONSTRAINT "BucketAction_pkey" PRIMARY KEY ("id")
);

-- ─── ItemAction: new FK columns ────────────────────────────────────────────

ALTER TABLE "ItemAction"
    ADD COLUMN "uploadActionId"     TEXT,
    ADD COLUMN "collectionActionId" TEXT,
    ADD COLUMN "favoriteActionId"   TEXT,
    ADD COLUMN "bucketActionId"     TEXT;

-- ─── Unique indexes (each ItemAction may link at most one of each type) ───

CREATE UNIQUE INDEX "ItemAction_uploadActionId_key"     ON "ItemAction"("uploadActionId");
CREATE UNIQUE INDEX "ItemAction_collectionActionId_key" ON "ItemAction"("collectionActionId");
CREATE UNIQUE INDEX "ItemAction_favoriteActionId_key"   ON "ItemAction"("favoriteActionId");
CREATE UNIQUE INDEX "ItemAction_bucketActionId_key"     ON "ItemAction"("bucketActionId");

-- ─── Foreign keys ──────────────────────────────────────────────────────────

ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_uploadActionId_fkey"
    FOREIGN KEY ("uploadActionId") REFERENCES "UploadAction"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_collectionActionId_fkey"
    FOREIGN KEY ("collectionActionId") REFERENCES "CollectionAction"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_favoriteActionId_fkey"
    FOREIGN KEY ("favoriteActionId") REFERENCES "FavoriteAction"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_bucketActionId_fkey"
    FOREIGN KEY ("bucketActionId") REFERENCES "BucketAction"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
