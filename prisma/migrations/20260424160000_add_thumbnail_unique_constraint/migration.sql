-- AddUniqueConstraint
CREATE UNIQUE INDEX "Thumbnail_itemId_view_size_key" ON "Thumbnail"("itemId", "view", "size");
