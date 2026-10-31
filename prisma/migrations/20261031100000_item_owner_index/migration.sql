-- Every "my items" query filters "Item" on "ownerId" (overview activity feed,
-- usage metrics, storage summary). With no index each one read the whole table,
-- every user's items included. Measured 31 Oct in a rolled-back probe: a
-- 4-activity feed 1.70 -> 0.25 ms, usage 1.65 -> 0.09 ms for a 1,737-item owner.
CREATE INDEX "owner_items" ON "Item"("ownerId");
