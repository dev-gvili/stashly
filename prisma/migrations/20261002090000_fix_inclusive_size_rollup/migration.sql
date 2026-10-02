-- update_size() keeps two rollups on the PARENT item:
--   "size"          bytes of the active (non-trashed) contents
--   "inclusiveSize" bytes of all contents, trash included
--
-- A child contributes to its parent:
--   to "size":          its "size", unless the child itself is trashed
--   to "inclusiveSize": a folder its own "inclusiveSize"; anything else its
--                       "size" (files carry "inclusiveSize" = 0)
--
-- The previous version passed a folder's "size" change up as an
-- "inclusiveSize" change, and never reacted to an "inclusiveSize" change.
-- Trashing a file two levels down therefore took its bytes off every
-- ancestor's "inclusiveSize" above the direct parent at trash time, and
-- permanently deleting it took them off nowhere; the two cancelled, so the
-- figure was wrong exactly while the file sat in trash.
CREATE OR REPLACE FUNCTION update_size()
RETURNS TRIGGER AS $$
DECLARE
  old_active BIGINT := 0;
  new_active BIGINT := 0;
  old_inclusive BIGINT := 0;
  new_inclusive BIGINT := 0;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    old_active := CASE WHEN OLD.status != 'trashed' THEN COALESCE(OLD.size, 0) ELSE 0 END;
    old_inclusive := CASE WHEN OLD.type = 'folder' THEN COALESCE(OLD."inclusiveSize", 0) ELSE COALESCE(OLD.size, 0) END;
  END IF;
  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    new_active := CASE WHEN NEW.status != 'trashed' THEN COALESCE(NEW.size, 0) ELSE 0 END;
    new_inclusive := CASE WHEN NEW.type = 'folder' THEN COALESCE(NEW."inclusiveSize", 0) ELSE COALESCE(NEW.size, 0) END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD."parentId" IS NOT NULL AND (old_active <> 0 OR old_inclusive <> 0) THEN
      UPDATE "Item"
      SET "inclusiveSize" = "inclusiveSize" - old_inclusive,
          "size" = "size" - old_active
      WHERE "id" = OLD."parentId"
        AND NOT stashly_is_wiping_user("ownerId");
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."parentId" IS NOT NULL AND (new_active <> 0 OR new_inclusive <> 0) THEN
      UPDATE "Item"
      SET "inclusiveSize" = "inclusiveSize" + new_inclusive,
          "size" = "size" + new_active
      WHERE "id" = NEW."parentId"
        AND NOT stashly_is_wiping_user("ownerId");
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."parentId" IS DISTINCT FROM NEW."parentId" THEN
      IF OLD."parentId" IS NOT NULL AND (old_active <> 0 OR old_inclusive <> 0) THEN
        UPDATE "Item"
        SET "inclusiveSize" = "inclusiveSize" - old_inclusive,
            "size" = "size" - old_active
        WHERE "id" = OLD."parentId"
          AND NOT stashly_is_wiping_user("ownerId");
      END IF;
      IF NEW."parentId" IS NOT NULL AND (new_active <> 0 OR new_inclusive <> 0) THEN
        UPDATE "Item"
        SET "inclusiveSize" = "inclusiveSize" + new_inclusive,
            "size" = "size" + new_active
        WHERE "id" = NEW."parentId"
          AND NOT stashly_is_wiping_user("ownerId");
      END IF;
    ELSIF NEW."parentId" IS NOT NULL
      AND (new_active <> old_active OR new_inclusive <> old_inclusive) THEN
      UPDATE "Item"
      SET "inclusiveSize" = "inclusiveSize" + (new_inclusive - old_inclusive),
          "size" = "size" + (new_active - old_active)
      WHERE "id" = NEW."parentId"
        AND NOT stashly_is_wiping_user("ownerId");
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- One-off recount of every folder's "size" and "inclusiveSize" from the
-- non-folder items beneath it, correcting what the old update_size() left
-- behind.
--
-- A single UPDATE can't do it: the trigger would add each folder's change to
-- its parent, which the same statement also sets. So the folders are set one
-- depth at a time, deepest first; each level overwrites whatever the level
-- below pushed into it, and the roots, which have no parent, end it. The
-- expected totals are read from the files once, before anything changes;
-- folder updates don't touch them.
DO $$
DECLARE
  d INT;
  max_depth INT;
BEGIN
  CREATE TEMP TABLE folder_depth ON COMMIT DROP AS
  WITH RECURSIVE walk AS (
    SELECT "id", "type", 0 AS depth FROM "Item" WHERE "parentId" IS NULL
    UNION ALL
    SELECT i."id", i."type", w.depth + 1 FROM "Item" i JOIN walk w ON i."parentId" = w."id"
  )
  SELECT "id", depth FROM walk WHERE "type" = 'folder';

  CREATE TEMP TABLE folder_totals ON COMMIT DROP AS
  WITH RECURSIVE below AS (
    -- every item under every folder, and whether anything on the way down
    -- (the item included) is in trash
    SELECT f."id" AS folder_id, c."id", c."type", c."size", c."status" = 'trashed' AS trashed_path
    FROM "Item" f JOIN "Item" c ON c."parentId" = f."id"
    WHERE f."type" = 'folder'
    UNION ALL
    SELECT b.folder_id, c."id", c."type", c."size", b.trashed_path OR c."status" = 'trashed'
    FROM below b JOIN "Item" c ON c."parentId" = b."id"
    WHERE b."type" = 'folder'
  )
  SELECT folder_id,
    COALESCE(SUM("size") FILTER (WHERE "type" <> 'folder' AND NOT trashed_path), 0)::bigint AS active,
    COALESCE(SUM("size") FILTER (WHERE "type" <> 'folder'), 0)::bigint AS inclusive
  FROM below
  GROUP BY folder_id;

  SELECT COALESCE(MAX(depth), 0) INTO max_depth FROM folder_depth;

  FOR d IN REVERSE max_depth..0 LOOP
    UPDATE "Item" f
    SET "size" = COALESCE(t.active, 0),
        "inclusiveSize" = COALESCE(t.inclusive, 0)
    FROM folder_depth fd
    LEFT JOIN folder_totals t ON t.folder_id = fd."id"
    WHERE f."id" = fd."id"
      AND fd.depth = d
      AND (f."size" IS DISTINCT FROM COALESCE(t.active, 0)
        OR f."inclusiveSize" IS DISTINCT FROM COALESCE(t.inclusive, 0));
  END LOOP;
END $$;
