-- =============================================================================
-- User-wipe trigger bypass
-- =============================================================================
-- emptyUserBucket() deletes an entire user's Item tree in one statement. The
-- size/count triggers maintained on Item conflict (Postgres 27000 — "tuple to
-- be updated was already modified by an operation triggered by the current
-- command") because the rows they try to UPDATE (parent items, sibling
-- collection items) are also being DELETEd by the same outer command.
--
-- This migration adds a session-flag escape hatch. When the caller sets both
--   stashly.delete_all_data_for_user         (= userId being wiped)
--   stashly.delete_all_data_for_user_consent (= any non-empty value, e.g. ISO
--                                              timestamp of consent)
-- on the connection, the trigger UPDATEs gain a WHERE filter that excludes
-- rows owned by that user. Rows owned by OTHER users (e.g. another user's
-- collection that contains a wipe-user's item) are still maintained correctly.
--
-- Both flags must be set — the consent variable is a safety belt against
-- a stale or accidental `SET stashly.delete_all_data_for_user` enabling the
-- bypass.

-- -----------------------------------------------------------------------------
-- Helper: returns true when the caller has flagged the current session as
-- doing a full wipe of `target_user_id`'s data. STABLE because the session
-- settings don't change within a single query.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION stashly_is_wiping_user(target_user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('stashly.delete_all_data_for_user', true) = target_user_id
     AND COALESCE(current_setting('stashly.delete_all_data_for_user_consent', true), '') <> '';
END;
$$ LANGUAGE plpgsql STABLE;


-- -----------------------------------------------------------------------------
-- sync_item_size_to_collections — propagates Item size changes to parent
-- collections via CollectionMember join. Filter the cross-row UPDATE to
-- skip collection items owned by the wipe user (those rows are themselves
-- being deleted in the same outer statement → 27000 conflict).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_item_size_to_collections()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.size > 0 THEN
      UPDATE "Item" c
      SET    size = c.size - OLD.size
      FROM   "CollectionMember" cm
      WHERE  cm."itemId"      = OLD.id
        AND  c.id             = cm."collectionId"
        AND  NOT stashly_is_wiping_user(c."ownerId");
    END IF;
    RETURN OLD;
  END IF;

  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  UPDATE "Item" c
  SET    size = c.size + (NEW.size - OLD.size)
  FROM   "CollectionMember" cm
  WHERE  cm."itemId" = NEW.id
    AND  c.id        = cm."collectionId"
    AND  NOT stashly_is_wiping_user(c."ownerId");

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- -----------------------------------------------------------------------------
-- update_size — propagates child Item size changes to the parent Item.
-- Filter to skip parents owned by the wipe user (parent is also being
-- deleted in the same outer statement → 27000 conflict).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_size()
RETURNS TRIGGER AS $$
DECLARE
  old_contrib BIGINT;
  new_contrib BIGINT;
  size_diff_inclusive BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."parentId" IS NOT NULL AND OLD.size > 0 THEN
      UPDATE "Item"
      SET
        "inclusiveSize" = "inclusiveSize" - OLD.size,
        "size" = CASE WHEN OLD.status != 'trashed' THEN "size" - OLD.size ELSE "size" END
      WHERE "id" = OLD."parentId"
        AND NOT stashly_is_wiping_user("ownerId");
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."parentId" IS NOT NULL AND NEW.size > 0 THEN
      UPDATE "Item"
      SET
        "inclusiveSize" = "inclusiveSize" + NEW.size,
        "size" = CASE WHEN NEW.status != 'trashed' THEN "size" + NEW.size ELSE "size" END
      WHERE "id" = NEW."parentId"
        AND NOT stashly_is_wiping_user("ownerId");
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."parentId" IS DISTINCT FROM NEW."parentId" THEN
      IF OLD."parentId" IS NOT NULL AND OLD.size > 0 THEN
        UPDATE "Item"
        SET
          "inclusiveSize" = "inclusiveSize" - OLD.size,
          "size" = CASE WHEN OLD.status != 'trashed' THEN "size" - OLD.size ELSE "size" END
        WHERE "id" = OLD."parentId"
          AND NOT stashly_is_wiping_user("ownerId");
      END IF;
      IF NEW."parentId" IS NOT NULL AND NEW.size > 0 THEN
        UPDATE "Item"
        SET
          "inclusiveSize" = "inclusiveSize" + NEW.size,
          "size" = CASE WHEN NEW.status != 'trashed' THEN "size" + NEW.size ELSE "size" END
        WHERE "id" = NEW."parentId"
          AND NOT stashly_is_wiping_user("ownerId");
      END IF;
    ELSIF OLD.size IS DISTINCT FROM NEW.size OR OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW."parentId" IS NOT NULL THEN
        old_contrib := CASE WHEN OLD.status != 'trashed' THEN COALESCE(OLD.size, 0) ELSE 0 END;
        new_contrib := CASE WHEN NEW.status != 'trashed' THEN COALESCE(NEW.size, 0) ELSE 0 END;
        size_diff_inclusive := COALESCE(NEW.size, 0) - COALESCE(OLD.size, 0);

        IF size_diff_inclusive != 0 OR (new_contrib - old_contrib) != 0 THEN
            UPDATE "Item"
            SET
              "inclusiveSize" = "inclusiveSize" + size_diff_inclusive,
              "size" = "size" + (new_contrib - old_contrib)
            WHERE "id" = NEW."parentId"
              AND NOT stashly_is_wiping_user("ownerId");
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;


-- -----------------------------------------------------------------------------
-- update_collection_size — fires on CollectionMember insert/delete and
-- updates the collection Item's size. Filter the UPDATE to skip collections
-- owned by the wipe user. Collections owned by OTHER users still get their
-- size correctly decremented when a wipe user's items leave the collection.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_collection_size()
RETURNS TRIGGER AS $$
DECLARE
  item_size BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT size INTO item_size FROM "Item" WHERE id = NEW."itemId";
    IF item_size > 0 THEN
      UPDATE "Item"
      SET    size = size + item_size
      WHERE  id = NEW."collectionId"
        AND  NOT stashly_is_wiping_user("ownerId");
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT size INTO item_size FROM "Item" WHERE id = OLD."itemId";
    IF item_size > 0 THEN
      UPDATE "Item"
      SET    size = size - item_size
      WHERE  id = OLD."collectionId"
        AND  NOT stashly_is_wiping_user("ownerId");
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
