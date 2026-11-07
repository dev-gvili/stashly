-- A status change writes each folder once (tech-debt item 51).
--
-- Per-row triggers wrote every ancestor once per changed row, inside one
-- transaction, and each write of the same row costs more than the last: a
-- restore of 20,000 files took 122 s and held those ancestors the whole time, a
-- trash of 50,000 failed at its 20 s transaction timeout, and the size rollup
-- gave way to those locks for every user (.claude/evidence/p51/).
--
-- A status change moves no bytes between rows. It only changes what a row adds
-- to its parent's `size` and `childCount`; `inclusiveSize` and
-- `inclusiveChildCount` count trash too and don't move. So:
--
-- 1. stashly_apply_folder_deltas() is the rollup's walk and writes, split out:
--    per-parent deltas in, each affected folder written once. Rows are locked
--    in id order first, so two overlapping statements can't deadlock, with FOR
--    NO KEY UPDATE, which an upload's foreign-key check on its parent doesn't
--    wait for. "Folder" before "Item", the order the triggers lock them in.
-- 2. apply_item_size_deltas() calls it, and otherwise behaves as before.
-- 3. update_size() and update_child_count() leave a pure status change alone.
-- 4. stashly_status_change(), a statement-level trigger, sums what the
--    statement changed per parent and calls (1) once. A row adds
--    new_active - old_active to its parent, folders included, and a delta
--    passes up only through a folder that isn't trashed after the statement:
--    the rule the rollup already walks by.
--
-- Postgres refuses a column list on a trigger with transition tables, so the
-- trigger fires on every UPDATE of "Item" and leaves at once when no status
-- changed. Inserts don't fire it directly; their ancestor writes do.

-- 1. The walk and the writes
CREATE OR REPLACE FUNCTION stashly_apply_folder_deltas(
  p_ids text[],
  p_active bigint[],
  p_inclusive bigint[],
  p_children integer[],
  p_inclusive_children integer[]
)
RETURNS integer AS $$
DECLARE
  v_ids text[];
  v_active bigint[];
  v_inclusive bigint[];
  v_child_ids text[];
  v_children integer[];
  v_inclusive_children integer[];
  v_counted integer := 0;
  v_written integer := 0;
BEGIN
  WITH RECURSIVE per_parent AS (
    SELECT * FROM unnest(p_ids, p_active, p_inclusive) AS u(id, a, i)
  ), up AS (
    -- A child count stops at its parent, so a row with no bytes walks nothing.
    SELECT id, a, i FROM per_parent WHERE a <> 0 OR i <> 0
    UNION ALL
    SELECT it."parentId", CASE WHEN it."status" = 'trashed' THEN 0 ELSE up.a END, up.i
    FROM up JOIN "Item" it ON it."id" = up.id
    WHERE it."parentId" IS NOT NULL
      AND ((CASE WHEN it."status" = 'trashed' THEN 0 ELSE up.a END) <> 0 OR up.i <> 0)
  ), agg AS (
    SELECT id, SUM(a)::bigint AS a, SUM(i)::bigint AS i FROM up GROUP BY id
  )
  SELECT array_agg(agg.id ORDER BY agg.id), array_agg(agg.a ORDER BY agg.id), array_agg(agg.i ORDER BY agg.id)
  INTO v_ids, v_active, v_inclusive
  FROM agg;

  SELECT array_agg(u.id ORDER BY u.id), array_agg(u.c ORDER BY u.id), array_agg(u.ic ORDER BY u.id)
  INTO v_child_ids, v_children, v_inclusive_children
  FROM unnest(p_ids, p_children, p_inclusive_children) AS u(id, c, ic)
  WHERE u.c <> 0 OR u.ic <> 0;

  -- "Folder" before "Item", the order the triggers lock them in on any other
  -- write (item_child_count_* fires before item_size_*): the other order can
  -- deadlock with a folder create, trash or move.
  IF v_child_ids IS NOT NULL THEN
    PERFORM 1 FROM "Folder" WHERE "itemId" = ANY(v_child_ids) ORDER BY "itemId" FOR NO KEY UPDATE;
    UPDATE "Folder" f
    SET "childCount" = f."childCount" + u.c,
        "inclusiveChildCount" = f."inclusiveChildCount" + u.ic
    FROM unnest(v_child_ids, v_children, v_inclusive_children) AS u(id, c, ic)
    WHERE f."itemId" = u.id;
    GET DIAGNOSTICS v_counted = ROW_COUNT;
  END IF;

  IF v_ids IS NOT NULL THEN
    PERFORM 1 FROM "Item" WHERE "id" = ANY(v_ids) ORDER BY "id" FOR NO KEY UPDATE;
    UPDATE "Item" t
    SET "size" = t."size" + u.a,
        "inclusiveSize" = t."inclusiveSize" + u.i
    FROM unnest(v_ids, v_active, v_inclusive) AS u(id, a, i)
    WHERE t."id" = u.id
      AND (u.a <> 0 OR u.i <> 0)
      AND NOT stashly_is_wiping_user(t."ownerId");
    GET DIAGNOSTICS v_written = ROW_COUNT;
  END IF;

  RETURN v_written + v_counted;
END;
$$ LANGUAGE plpgsql;

-- 2. The rollup, on the shared walk
CREATE OR REPLACE FUNCTION apply_item_size_deltas(max_deltas integer DEFAULT 5000, wait_for_lock boolean DEFAULT false)
RETURNS TABLE (deltas integer, ancestors integer, oldest_ms double precision) AS $$
DECLARE
  v_ids text[];
  v_active bigint[];
  v_inclusive bigint[];
  v_children integer[];
  v_deltas integer := 0;
  v_quota_deltas integer := 0;
  v_oldest timestamptz;
  v_quota_oldest timestamptz;
  v_written integer := 0;
  v_charged integer := 0;
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

  WITH claimed AS (
    DELETE FROM "ItemSizeDelta"
    WHERE "id" IN (SELECT "id" FROM "ItemSizeDelta" ORDER BY "id" LIMIT max_deltas)
    RETURNING "parentId", "active", "inclusive", "children", "createdAt"
  ), per_parent AS (
    SELECT "parentId" AS id, SUM("active")::bigint AS a, SUM("inclusive")::bigint AS i, SUM("children")::integer AS c
    FROM claimed GROUP BY 1
  )
  SELECT array_agg(p.id ORDER BY p.id), array_agg(p.a ORDER BY p.id), array_agg(p.i ORDER BY p.id), array_agg(p.c ORDER BY p.id),
         (SELECT COUNT(*) FROM claimed)::integer, (SELECT MIN("createdAt") FROM claimed)
  INTO v_ids, v_active, v_inclusive, v_children, v_deltas, v_oldest
  FROM per_parent p;

  IF v_ids IS NOT NULL THEN
    v_written := stashly_apply_folder_deltas(v_ids, v_active, v_inclusive, v_children, v_children);
  END IF;

  WITH claimed AS (
    DELETE FROM "QuotaDelta"
    WHERE "id" IN (SELECT "id" FROM "QuotaDelta" ORDER BY "id" LIMIT max_deltas)
    RETURNING "driveId", "used", "createdAt"
  ), per_drive AS (
    SELECT "driveId", SUM("used")::bigint AS used, COUNT(*)::integer AS n, MIN("createdAt") AS oldest
    FROM claimed GROUP BY 1
  ), charged AS (
    UPDATE "Quota" q
    SET "used" = q."used" + p.used,
        "status" = stashly_quota_status(q."used" + p.used, q."total"),
        "updatedAt" = (now() AT TIME ZONE 'UTC')
    FROM per_drive p
    WHERE q."driveId" = p."driveId"
    RETURNING q."id"
  )
  SELECT COALESCE((SELECT SUM(n) FROM per_drive), 0)::integer,
         (SELECT MIN(oldest) FROM per_drive),
         (SELECT COUNT(*) FROM charged)::integer
  INTO v_quota_deltas, v_quota_oldest, v_charged;

  PERFORM set_config('stashly.rollup', 'off', true);
  PERFORM set_config('lock_timeout', v_lock_timeout, true);
  RETURN QUERY SELECT v_deltas + v_quota_deltas, v_written + v_charged,
    COALESCE(EXTRACT(EPOCH FROM (clock_timestamp() - LEAST(v_oldest, v_quota_oldest))) * 1000, 0)::double precision;
END;
$$ LANGUAGE plpgsql;

-- 3. The row triggers leave a pure status change to the statement trigger
CREATE OR REPLACE FUNCTION update_size()
RETURNS TRIGGER AS $$
DECLARE
  old_active BIGINT := 0;
  new_active BIGINT := 0;
  old_inclusive BIGINT := 0;
  new_inclusive BIGINT := 0;
  log_upload BOOLEAN := false;
BEGIN
  -- apply_item_size_deltas() writes every ancestor itself: its writes must not
  -- cascade.
  IF current_setting('stashly.rollup', true) = 'on' THEN
    RETURN NULL;
  END IF;

  -- A status change alone: stashly_status_change() writes each folder once.
  IF TG_OP = 'UPDATE'
    AND OLD."status" IS DISTINCT FROM NEW."status"
    AND OLD."parentId" IS NOT DISTINCT FROM NEW."parentId"
    AND OLD."size" IS NOT DISTINCT FROM NEW."size"
    AND OLD."inclusiveSize" IS NOT DISTINCT FROM NEW."inclusiveSize" THEN
    RETURN NULL;
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
      -- An uploaded row while the database is busy: log it for the rollup.
      -- Pending deltas are checked FIRST, and the lock is only tried when
      -- there are none: a logged upload that took the lock would hold it until
      -- it commits, and under steady load the rollup never got it (measured:
      -- 32 uploaders, 10 of 10 rollups skipped, 15,670 deltas left for the end).
      -- IF/ELSIF fixes that order; SQL does not promise to evaluate an OR
      -- left to right.
      IF NEW."uploadId" IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM "ItemSizeDelta") THEN
          log_upload := true;
        ELSIF NOT pg_try_advisory_xact_lock(hashtext('stashly.item_size_rollup')) THEN
          log_upload := true;
        END IF;
      END IF;
      IF log_upload THEN
        INSERT INTO "ItemSizeDelta" ("parentId", "active", "inclusive")
        VALUES (NEW."parentId", new_active, new_inclusive);
        RETURN NEW;
      END IF;
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

CREATE OR REPLACE FUNCTION update_child_count()
RETURNS TRIGGER AS $$
DECLARE
  log_upload BOOLEAN := false;
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD."parentId" IS NOT NULL THEN
      UPDATE "Folder"
      SET
        "inclusiveChildCount" = "inclusiveChildCount" - 1,
        "childCount" = CASE WHEN OLD.status != 'trashed' THEN "childCount" - 1 ELSE "childCount" END
      WHERE "itemId" = OLD."parentId";
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    IF NEW."parentId" IS NOT NULL THEN
      -- An uploaded row while the database is busy: log it for the rollup, on
      -- the test update_size() uses. Pending deltas FIRST, the lock only when
      -- there are none. This trigger fires before item_size_update, which then
      -- finds this row pending and logs too.
      IF NEW."uploadId" IS NOT NULL AND NEW.status != 'trashed' THEN
        IF EXISTS (SELECT 1 FROM "ItemSizeDelta") OR EXISTS (SELECT 1 FROM "QuotaDelta") THEN
          log_upload := true;
        ELSIF NOT pg_try_advisory_xact_lock(hashtext('stashly.item_size_rollup')) THEN
          log_upload := true;
        END IF;
      END IF;
      IF log_upload THEN
        INSERT INTO "ItemSizeDelta" ("parentId", "active", "inclusive", "children")
        VALUES (NEW."parentId", 0, 0, 1);
        RETURN NEW;
      END IF;
      UPDATE "Folder"
      SET
        "inclusiveChildCount" = "inclusiveChildCount" + 1,
        "childCount" = CASE WHEN NEW.status != 'trashed' THEN "childCount" + 1 ELSE "childCount" END
      WHERE "itemId" = NEW."parentId";
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE. A status change under the same parent is
  -- stashly_status_change()'s.
  IF TG_OP = 'UPDATE' THEN
    -- If parentId changed (item moved)
    IF OLD."parentId" IS DISTINCT FROM NEW."parentId" THEN
      -- Decrement counts for the old parent
      IF OLD."parentId" IS NOT NULL THEN
        UPDATE "Folder"
        SET
          "inclusiveChildCount" = "inclusiveChildCount" - 1,
          "childCount" = CASE WHEN OLD.status != 'trashed' THEN "childCount" - 1 ELSE "childCount" END
        WHERE "itemId" = OLD."parentId";
      END IF;
      -- Increment counts for the new parent
      IF NEW."parentId" IS NOT NULL THEN
        UPDATE "Folder"
        SET
          "inclusiveChildCount" = "inclusiveChildCount" + 1,
          "childCount" = CASE WHEN NEW.status != 'trashed' THEN "childCount" + 1 ELSE "childCount" END
        WHERE "itemId" = NEW."parentId";
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. One write per folder for everything a statement's status change touched
CREATE OR REPLACE FUNCTION stashly_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_ids text[];
  v_active bigint[];
  v_children integer[];
  v_zeros bigint[];
  v_no_children integer[];
BEGIN
  -- An update made by a trigger is an ancestor write of the size cascade, and a
  -- status only ever changes in a statement of its own. Leaving here keeps an
  -- upload's cascade from paying for the query below once per ancestor
  -- (measured: +20% on an idle upload statement without this).
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  -- The rollup's and this function's own writes change no status.
  IF current_setting('stashly.rollup', true) = 'on' THEN
    RETURN NULL;
  END IF;

  -- GROUP BY, never a join of the two tables: plpgsql keeps the plan it made
  -- first, and a nested loop planned for a one-row update then ran on 20,000
  -- rows (measured: a second trash took 140 s against 4.5 s for the first).
  WITH sides AS (
    SELECT "id", "parentId", "status", "size", "inclusiveSize", true AS after FROM status_new
    UNION ALL
    SELECT "id", "parentId", "status", "size", "inclusiveSize", false FROM status_old
  ), paired AS (
    SELECT
      max("parentId") FILTER (WHERE after) AS new_parent,
      max("parentId") FILTER (WHERE NOT after) AS old_parent,
      max("status") FILTER (WHERE after) AS new_status,
      max("status") FILTER (WHERE NOT after) AS old_status,
      max("size") FILTER (WHERE after) AS new_size,
      max("size") FILTER (WHERE NOT after) AS old_size,
      max("inclusiveSize") FILTER (WHERE after) AS new_inclusive,
      max("inclusiveSize") FILTER (WHERE NOT after) AS old_inclusive
    FROM sides
    GROUP BY "id"
  ), changed AS (
    SELECT new_parent AS id,
      -- The same test update_size() leaves alone.
      CASE WHEN old_size IS NOT DISTINCT FROM new_size AND old_inclusive IS NOT DISTINCT FROM new_inclusive
        THEN COALESCE(new_size, 0) * ((new_status <> 'trashed')::integer - (old_status <> 'trashed')::integer)
        ELSE 0 END AS a,
      (new_status <> 'trashed')::integer - (old_status <> 'trashed')::integer AS c
    FROM paired
    WHERE old_status IS DISTINCT FROM new_status
      AND old_parent IS NOT DISTINCT FROM new_parent
      AND new_parent IS NOT NULL
  ), per_parent AS (
    SELECT id, SUM(a)::bigint AS a, SUM(c)::integer AS c FROM changed GROUP BY id
  )
  SELECT array_agg(id ORDER BY id), array_agg(a ORDER BY id), array_agg(c ORDER BY id),
         array_agg(0::bigint), array_agg(0::integer)
  INTO v_ids, v_active, v_children, v_zeros, v_no_children
  FROM per_parent
  WHERE a <> 0 OR c <> 0;

  IF v_ids IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM set_config('stashly.rollup', 'on', true);
  PERFORM stashly_apply_folder_deltas(v_ids, v_active, v_zeros, v_children, v_no_children);
  PERFORM set_config('stashly.rollup', 'off', true);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS item_status_change ON "Item";
CREATE TRIGGER item_status_change
AFTER UPDATE ON "Item"
REFERENCING OLD TABLE AS status_old NEW TABLE AS status_new
FOR EACH STATEMENT
EXECUTE FUNCTION stashly_status_change();
