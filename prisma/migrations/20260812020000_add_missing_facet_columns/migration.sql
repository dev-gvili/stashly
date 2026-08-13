-- Facet models drifted ahead of the database: fields were added to
-- prisma/models/facet.prisma without a matching migration, so item creation
-- failed with "column t2.bitDepth does not exist" and Markdown facet writes
-- had no table at all. This brings Image, Pdf and Markdown back in sync.

-- AlterTable: bits per channel captured during image facet extraction
ALTER TABLE "Image" ADD COLUMN "bitDepth" INTEGER;

-- AlterTable: first-page media box in PDF points (1pt = 1/72in) — drives "Page size"
ALTER TABLE "Pdf" ADD COLUMN "pageWidth" DOUBLE PRECISION,
                 ADD COLUMN "pageHeight" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Markdown" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "author" TEXT,
    "description" TEXT,
    "tags" TEXT,
    "wordCount" INTEGER,
    "readingTime" INTEGER,
    "headingCount" INTEGER,
    "linkCount" INTEGER,
    "imageCount" INTEGER,
    "codeBlockCount" INTEGER,
    "taskCount" INTEGER,
    "hasFrontmatter" BOOLEAN,
    "docCreatedAt" TIMESTAMP(3),
    "docModifiedAt" TIMESTAMP(3),
    "itemId" TEXT NOT NULL,

    CONSTRAINT "Markdown_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Markdown_itemId_key" ON "Markdown"("itemId");

-- AddForeignKey
ALTER TABLE "Markdown" ADD CONSTRAINT "Markdown_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
