-- CreateTable
CREATE TABLE "Pdf" (
    "id" TEXT NOT NULL,
    "pageCount" INTEGER,
    "title" TEXT,
    "author" TEXT,
    "subject" TEXT,
    "keywords" TEXT,
    "creator" TEXT,
    "producer" TEXT,
    "pdfVersion" TEXT,
    "language" TEXT,
    "isEncrypted" BOOLEAN,
    "hasFormFields" BOOLEAN,
    "hasAnnotations" BOOLEAN,
    "hasSignatures" BOOLEAN,
    "docCreatedAt" TIMESTAMP(3),
    "docModifiedAt" TIMESTAMP(3),
    "itemId" TEXT NOT NULL,

    CONSTRAINT "Pdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pdf_itemId_key" ON "Pdf"("itemId");

-- AddForeignKey
ALTER TABLE "Pdf" ADD CONSTRAINT "Pdf_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
