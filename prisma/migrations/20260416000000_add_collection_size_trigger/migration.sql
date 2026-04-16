-- =============================================================================
-- TRIGGER 1: CollectionMember INSERT/DELETE  →  update collection Item.size
-- =============================================================================
-- Handles the explicit "add item to collection" / "remove item from collection"
-- path (i.e. rows inserted or deleted directly on CollectionMember).
--
-- DELETE edge-case: when a member Item is hard-deleted, Postgres cascades the
-- CollectionMember row deletion. By the time this trigger fires the member row
-- is already gone, so the SELECT below returns NULL and the IF guard prevents
-- any update. That is intentional — item_delete_collection_sync_trigger (below)
-- handles that path BEFORE the cascade, while OLD.size is still valid.

CREATE OR REPLACE FUNCTION update_collection_size()
RETURNS TRIGGER AS $$
DECLARE
  item_size BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT size INTO item_size FROM "Item" WHERE id = NEW."itemId";
    IF item_size > 0 THEN
      UPDATE "Item" SET size = size + item_size WHERE id = NEW."collectionId";
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- item may already be deleted (cascade); NULL result is safe — the
    -- item_delete_collection_sync_trigger already decremented the collection.
    SELECT size INTO item_size FROM "Item" WHERE id = OLD."itemId";
    IF item_size > 0 THEN
      UPDATE "Item" SET size = size - item_size WHERE id = OLD."collectionId";
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collection_size_trigger
AFTER INSERT OR DELETE ON "CollectionMember"
FOR EACH ROW EXECUTE FUNCTION update_collection_size();


-- =============================================================================
-- TRIGGER 2: Item size UPDATE / BEFORE DELETE  →  sync to parent collections
-- =============================================================================
-- Two responsibilities in one function, two triggers pointing at it:
--
--   a) AFTER UPDATE OF size  — propagates a size delta to every collection this
--      item belongs to. pg_trigger_depth() guard stops infinite recursion: when
--      this trigger updates a collection's own size row, Postgres would re-fire
--      the trigger on that row; depth > 1 short-circuits that second call.
--
--   b) BEFORE DELETE  — subtracts OLD.size from all parent collections BEFORE
--      the ON DELETE CASCADE removes the CollectionMember rows. Firing BEFORE
--      the cascade ensures OLD.size is still readable from the Item table.
--      RETURN OLD allows the delete to proceed; RETURN NULL would cancel it.

CREATE OR REPLACE FUNCTION sync_item_size_to_collections()
RETURNS TRIGGER AS $$
BEGIN
  -- (b) Item is about to be deleted: remove its size contribution from every
  --     collection it belongs to while the row is still visible.
  IF TG_OP = 'DELETE' THEN
    IF OLD.size > 0 THEN
      UPDATE "Item" c
      SET    size = c.size - OLD.size
      FROM   "CollectionMember" cm
      WHERE  cm."itemId"      = OLD.id
        AND  c.id             = cm."collectionId";
    END IF;
    RETURN OLD;  -- must return OLD (not NULL) to allow the delete
  END IF;

  -- (a) Item size was updated. Guard against the recursive re-fire that happens
  --     when updating a collection's own size triggers this function again.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  UPDATE "Item" c
  SET    size = c.size + (NEW.size - OLD.size)
  FROM   "CollectionMember" cm
  WHERE  cm."itemId" = NEW.id
    AND  c.id        = cm."collectionId";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (a) Propagate size delta when an item's own size changes.
CREATE TRIGGER item_size_collection_sync_trigger
AFTER UPDATE OF size ON "Item"
FOR EACH ROW
WHEN (OLD.size IS DISTINCT FROM NEW.size)
EXECUTE FUNCTION sync_item_size_to_collections();

-- (b) Subtract size from parent collections before hard-delete cascade.
CREATE TRIGGER item_delete_collection_sync_trigger
BEFORE DELETE ON "Item"
FOR EACH ROW
EXECUTE FUNCTION sync_item_size_to_collections();


-- =============================================================================
-- VERIFICATION QUERIES (run after applying migration)
-- =============================================================================

-- 1. Confirm all three triggers exist on the correct tables
-- SELECT
--   trigger_name,
--   event_object_table  AS "table",
--   event_manipulation  AS event,
--   action_timing       AS timing
-- FROM information_schema.triggers
-- WHERE trigger_name IN (
--   'collection_size_trigger',
--   'item_size_collection_sync_trigger',
--   'item_delete_collection_sync_trigger'
-- )
-- ORDER BY trigger_name, event;

-- 2. Confirm both functions are registered in the public schema
-- SELECT proname AS function, pronargs AS args
-- FROM   pg_proc
-- WHERE  proname IN ('update_collection_size', 'sync_item_size_to_collections')
--   AND  pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. Integrity audit: collections whose stored size drifts from the member sum
--    (run before applying to find pre-existing staleness, and after to confirm 0 rows)
-- SELECT
--   c.id                             AS collection_id,
--   c.name                           AS collection_name,
--   c.size                           AS stored_size,
--   COALESCE(SUM(m.size), 0)         AS computed_size,
--   c.size - COALESCE(SUM(m.size), 0) AS drift
-- FROM       "Item"             c
-- LEFT JOIN  "CollectionMember" cm ON cm."collectionId" = c.id
-- LEFT JOIN  "Item"             m  ON m.id = cm."itemId"
-- WHERE c.type = 'collection'
-- GROUP BY c.id, c.name, c.size
-- HAVING c.size != COALESCE(SUM(m.size), 0);

-- 4. Repair: reset drifted collection sizes to the computed value
--    (safe to run multiple times; only touches rows where drift != 0)
-- UPDATE "Item" c
-- SET    size = sub.computed
-- FROM (
--   SELECT c2.id, COALESCE(SUM(m.size), 0) AS computed
--   FROM       "Item"             c2
--   LEFT JOIN  "CollectionMember" cm ON cm."collectionId" = c2.id
--   LEFT JOIN  "Item"             m  ON m.id = cm."itemId"
--   WHERE  c2.type = 'collection'
--   GROUP BY c2.id
-- ) sub
-- WHERE c.id   = sub.id
--   AND c.size != sub.computed;
