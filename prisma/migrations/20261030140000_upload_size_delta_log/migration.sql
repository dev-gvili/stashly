-- Uploaded files reach their folders' sizes through a delta log instead of
-- rewriting every ancestor row, one at a time, inside their own INSERT.
--
-- Before: update_size() updated the parent, whose UPDATE fired update_size()
-- again, up to the owner's root. In a shared folder every uploader therefore
-- queued on the same ancestor rows. Measured (tech-debt item 42), 32 uploaders
-- into one shared folder: ~2,000 files/s, 21 of 32 waiting on a row lock, p95
-- 52 ms. A prototype of this design: ~9,000 files/s, 0 waiting, p95 5.5 ms,
-- 96% fewer ancestor writes, exact sizes in every run.
--
-- After:
--   * An Item insert with an "uploadId" (insertUploadedItem writes one) adds a
--     row to "ItemSizeDelta" (log_upload_size) and update_size() skips it.
--   * apply_item_size_deltas() applies pending rows: each parent and each of
--     its CURRENT ancestors is written once per run; the active part stops at
--     a trashed folder, as in update_size(). One run at a time for the whole
--     database (advisory lock; a second caller skips). A run that waits more
--     than 100 ms for a row lock gives up and leaves its rows for the next one,
--     so it never wins a lock fight against a user's trash, move or delete.
--     app/.server/size-rollup.ts calls it every 250 ms.
--   * Every other path (folder creation, copy, trash, restore, move, delete, a
--     size change) keeps the per-row cascade. Deltas are additive and those
--     paths only cascade what has already been applied, so the two compose.
--   * recount_folder_sizes(root) recounts a subtree from its files: the test
--     oracle and a repair tool.
--
-- Transient: an upload deleted, moved or trashed before the next run cascades
-- its size off folders that never received it, so they read short (even
-- negative) until that run adds it, about 250 ms at most. The end state is
-- exact either way.
--
-- KEEP IN SYNC: log_upload_size() and the INSERT guard in update_size() must
-- agree on which inserts are deferred ("uploadId" IS NOT NULL).
--
-- Rollback (rehearsed in a rolled-back transaction): drain with
-- SELECT * FROM apply_item_size_deltas(NULL, true); drop trigger
-- item_size_log_upload and function log_upload_size(); re-run the update_size()
-- definition from 20261002090000_fix_inclusive_size_rollup; drop function
-- apply_item_size_deltas(integer, boolean); remove the ItemSizeDelta model so a
-- new migration drops the table. Keep recount_folder_sizes().

-- CreateTable
CREATE TABLE "ItemSizeDelta" (
    "id" BIGSERIAL NOT NULL,
    "parentId" TEXT NOT NULL,
    "active" BIGINT NOT NULL,
    "inclusive" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemSizeDelta_pkey" PRIMARY KEY ("id")
);

-- An uploaded item's contribution to its parent, logged instead of cascaded.
-- The checks live in the function, not in a trigger WHEN clause: on 2026-10-30
-- WHEN clauses on the Item triggers measured 9.5% slower overall.
CREATE OR REPLACE FUNCTION log_upload_size()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."uploadId" IS NULL OR NEW."parentId" IS NULL OR (NEW."size" = 0 AND NEW."inclusiveSize" = 0) THEN
    RETURN NULL;
  END IF;
  INSERT INTO "ItemSizeDelta" ("parentId", "active", "inclusive")
  VALUES (
    NEW."parentId",
    CASE WHEN NEW."status" <> 'trashed' THEN NEW."size" ELSE 0 END,
    CASE WHEN NEW."type" = 'folder' THEN NEW."inclusiveSize" ELSE NEW."size" END
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER item_size_log_upload
AFTER INSERT ON "Item"
FOR EACH ROW
EXECUTE FUNCTION log_upload_size();

-- update_size() as of 20261002090000_fix_inclusive_size_rollup, plus the two
-- guards at the top.
CREATE OR REPLACE FUNCTION update_size()
RETURNS TRIGGER AS $$
DECLARE
  old_active BIGINT := 0;
  new_active BIGINT := 0;
  old_inclusive BIGINT := 0;
  new_inclusive BIGINT := 0;
BEGIN
  -- apply_item_size_deltas() writes every ancestor itself: its writes must not
  -- cascade.
  IF current_setting('stashly.rollup', true) = 'on' THEN
    RETURN NULL;
  END IF;
  -- An uploaded item is logged by log_upload_size() and applied by
  -- apply_item_size_deltas(). KEEP IN SYNC with log_upload_size().
  IF TG_OP = 'INSERT' AND NEW."uploadId" IS NOT NULL THEN
    RETURN NEW;
  END IF;

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

-- Applies up to max_deltas pending rows (NULL: all). Returns how many deltas it
-- applied, how many Item rows it wrote, and how old the oldest applied delta
-- was. wait_for_lock = false (the timer): skip if another run holds the lock,
-- and give up after 100 ms waiting for a row lock, leaving the rows for the
-- next run. wait_for_lock = true (tests, recount): wait for both.
CREATE OR REPLACE FUNCTION apply_item_size_deltas(max_deltas integer DEFAULT 5000, wait_for_lock boolean DEFAULT false)
RETURNS TABLE (deltas integer, ancestors integer, oldest_ms double precision) AS $$
DECLARE
  v_ids text[];
  v_active bigint[];
  v_inclusive bigint[];
  v_deltas integer := 0;
  v_oldest timestamptz;
  v_written integer := 0;
  v_lock_timeout text := current_setting('lock_timeout');
BEGIN
  IF wait_for_lock THEN
    PERFORM pg_advisory_xact_lock(hashtext('stashly.item_size_rollup'));
  ELSIF NOT pg_try_advisory_xact_lock(hashtext('stashly.item_size_rollup')) THEN
    RETURN QUERY SELECT 0, 0, 0::double precision;
    RETURN;
  END IF;
  PERFORM set_config('stashly.rollup', 'on', true);
  IF NOT wait_for_lock THEN
    PERFORM set_config('lock_timeout', '100ms', true);
  END IF;

  WITH RECURSIVE claimed AS (
    DELETE FROM "ItemSizeDelta"
    WHERE "id" IN (SELECT "id" FROM "ItemSizeDelta" ORDER BY "id" LIMIT max_deltas)
    RETURNING "parentId", "active", "inclusive", "createdAt"
  ), per_parent AS (
    SELECT "parentId" AS id, SUM("active") AS a, SUM("inclusive") AS i FROM claimed GROUP BY 1
  ), up AS (
    SELECT id, a, i FROM per_parent
    UNION ALL
    SELECT it."parentId", CASE WHEN it."status" = 'trashed' THEN 0 ELSE up.a END, up.i
    FROM up JOIN "Item" it ON it."id" = up.id
    WHERE it."parentId" IS NOT NULL
  ), agg AS (
    SELECT id, SUM(a)::bigint AS a, SUM(i)::bigint AS i FROM up GROUP BY id
  )
  SELECT array_agg(agg.id ORDER BY agg.id), array_agg(agg.a ORDER BY agg.id), array_agg(agg.i ORDER BY agg.id),
         (SELECT COUNT(*) FROM claimed)::integer, (SELECT MIN("createdAt") FROM claimed)
  INTO v_ids, v_active, v_inclusive, v_deltas, v_oldest
  FROM agg;

  IF v_ids IS NOT NULL THEN
    UPDATE "Item" t
    SET "size" = t."size" + u.a,
        "inclusiveSize" = t."inclusiveSize" + u.i
    FROM unnest(v_ids, v_active, v_inclusive) AS u(id, a, i)
    WHERE t."id" = u.id
      AND (u.a <> 0 OR u.i <> 0)
      AND NOT stashly_is_wiping_user(t."ownerId");
    GET DIAGNOSTICS v_written = ROW_COUNT;
  END IF;

  PERFORM set_config('stashly.rollup', 'off', true);
  PERFORM set_config('lock_timeout', v_lock_timeout, true);
  RETURN QUERY SELECT v_deltas, v_written,
    COALESCE(EXTRACT(EPOCH FROM (clock_timestamp() - v_oldest)) * 1000, 0)::double precision;
END;
$$ LANGUAGE plpgsql;

-- Sets "size" and "inclusiveSize" of every folder in the subtree at root (root
-- included) from the files beneath it, deepest level first, and returns how
-- many folders it rewrote. A folder put right by the cascade from a level
-- below is not counted, so 0 means nothing was wrong but 1 can mean several.
-- Pending deltas are applied first. Each level's update
-- cascades to the level above, which the next pass overwrites; root's change
-- carries on to its own ancestors, which is what they must receive. The same
-- recount 20261002090000_fix_inclusive_size_rollup ran once, scoped to a tree.
CREATE OR REPLACE FUNCTION recount_folder_sizes(root text)
RETURNS integer AS $$
DECLARE
  d integer;
  max_depth integer;
  n integer;
  changed integer := 0;
BEGIN
  PERFORM apply_item_size_deltas(NULL, true);

  CREATE TEMP TABLE IF NOT EXISTS recount_folder_depth (id text PRIMARY KEY, depth integer NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE IF NOT EXISTS recount_folder_totals (folder_id text PRIMARY KEY, active bigint NOT NULL, inclusive bigint NOT NULL) ON COMMIT DROP;
  TRUNCATE recount_folder_depth, recount_folder_totals;

  INSERT INTO recount_folder_depth (id, depth)
  WITH RECURSIVE walk AS (
    SELECT "id", "type", 0 AS depth FROM "Item" WHERE "id" = root
    UNION ALL
    SELECT i."id", i."type", w.depth + 1 FROM "Item" i JOIN walk w ON i."parentId" = w."id"
  )
  SELECT "id", depth FROM walk WHERE "type" = 'folder';

  -- every item under every folder, and whether anything on the way down (the
  -- item included) is in trash
  INSERT INTO recount_folder_totals (folder_id, active, inclusive)
  WITH RECURSIVE below AS (
    SELECT fd.id AS folder_id, c."id", c."type", c."size", c."status" = 'trashed' AS trashed_path
    FROM recount_folder_depth fd JOIN "Item" c ON c."parentId" = fd.id
    UNION ALL
    SELECT b.folder_id, c."id", c."type", c."size", b.trashed_path OR c."status" = 'trashed'
    FROM below b JOIN "Item" c ON c."parentId" = b."id"
    WHERE b."type" = 'folder'
  )
  SELECT folder_id,
    COALESCE(SUM("size") FILTER (WHERE "type" <> 'folder' AND NOT trashed_path), 0)::bigint,
    COALESCE(SUM("size") FILTER (WHERE "type" <> 'folder'), 0)::bigint
  FROM below
  GROUP BY folder_id;

  SELECT COALESCE(MAX(depth), -1) INTO max_depth FROM recount_folder_depth;
  FOR d IN REVERSE max_depth..0 LOOP
    UPDATE "Item" f
    SET "size" = COALESCE(t.active, 0),
        "inclusiveSize" = COALESCE(t.inclusive, 0)
    FROM recount_folder_depth fd
    LEFT JOIN recount_folder_totals t ON t.folder_id = fd.id
    WHERE f."id" = fd.id
      AND fd.depth = d
      AND (f."size" IS DISTINCT FROM COALESCE(t.active, 0)
        OR f."inclusiveSize" IS DISTINCT FROM COALESCE(t.inclusive, 0));
    GET DIAGNOSTICS n = ROW_COUNT;
    changed := changed + n;
  END LOOP;
  RETURN changed;
END;
$$ LANGUAGE plpgsql;
