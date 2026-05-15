-- CreateTable
CREATE TABLE "PinItem" (
    "id" TEXT NOT NULL,
    "pinnedById" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PinItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PinItem_pinnedById_position_idx" ON "PinItem"("pinnedById", "position");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "PinItem_pinnedById_itemId_key" ON "PinItem"("pinnedById", "itemId");

-- AddForeignKey
ALTER TABLE "PinItem" ADD CONSTRAINT "PinItem_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinItem" ADD CONSTRAINT "PinItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
