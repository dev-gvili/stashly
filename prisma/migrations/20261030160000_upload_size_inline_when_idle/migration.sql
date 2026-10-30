-- Uploads cascade at once while the database is idle, and go through the size
-- log only while it is busy.
--
-- 20261030140000_upload_size_delta_log logged every upload. Under concurrency
-- that was the win it was built for (32 uploaders into one shared folder:
-- 2,017 -> 8,419 files/s, lock waiters 20.7 -> 0, ancestor writes -96%). But
-- one uploader alone (~1.4 files/s) gave each 250 ms rollup about one delta
-- (580 runs, 1.1 each), so the run's fixed cost replaced a cheap cascade: size
-- work 615 -> 2,125 ms for a 650-file upload, WAL +19%.
--
-- Now update_size() decides per uploaded row, on INSERT:
--   * Busy: deltas are pending, or another statement holds the rollup's
--     advisory lock (a rollup, or an upload cascading now). It appends to
--     "ItemSizeDelta" and returns; apply_item_size_deltas() merges it with the
--     rest. Pending deltas are checked first, so a busy upload never takes the
--     lock and the rollup can always get it.
--   * Idle: nothing is pending and it gets the lock without waiting. It
--     cascades now, exactly as for any other insert, and keeps the lock until
--     the statement commits, so a rollup can't run meanwhile.
-- The lock is only ever tried, never waited for, so no upload blocks on it, and
-- at most one upload cascades at a time, so cascades never queue on shared
-- ancestor rows. Both paths add the same amounts, so any mix sums exactly.
--
-- The decision and the logging now live in update_size() alone:
-- log_upload_size() and its trigger are dropped.
--
-- Rollback: re-run the update_size() definition and the log_upload_size()
-- function and item_size_log_upload trigger from
-- 20261030140000_upload_size_delta_log.

DROP TRIGGER IF EXISTS item_size_log_upload ON "Item";
DROP FUNCTION IF EXISTS log_upload_size();

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
