-- Favorite indexes drifted: the model dropped the (favoritedById, itemId)
-- unique in favour of four named lookup indexes, but no migration followed.
-- This syncs the database to prisma/models/favorite.prisma.
--
-- NOTE: the composite unique goes away, so duplicate (favoritedById, itemId)
-- rows are no longer prevented at the DB level — favorite creation must stay
-- idempotent in application code.

-- DropIndex
DROP INDEX "Favorite_favoritedById_itemId_key";

-- CreateIndex
CREATE INDEX "favoritedById_id_idx" ON "Favorite"("favoritedById", "id");

-- CreateIndex
CREATE INDEX "itemId_id_idx" ON "Favorite"("itemId", "id");

-- CreateIndex
CREATE INDEX "favoritedById_itemId_idx" ON "Favorite"("favoritedById", "itemId");

-- CreateIndex
CREATE INDEX "createdAt_idx" ON "Favorite"("createdAt");
