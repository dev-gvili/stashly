-- Takes the two shared rows out of a busy upload's statement (tech-debt item 47).
--
-- Measured with 32 uploaders running the real statement (.claude/evidence/p47):
-- nothing shared 3,753 files/s; all into one folder 1,416, 24 of 32 waiting on
-- its "Folder" row; one drive's "Quota" row 532, 29 of 32 waiting. A row lock is
-- held until commit, and the charge ran first in the statement, so every upload
-- on a drive queued for nearly the whole statement.
--
-- 1. "Quota_updatedAt_idx" is dropped. Every charge writes "updatedAt", so with
--    the index no charge could be a HOT update (5-15 of 9,600 were): each one
--    wrote every index. "updatedAt" is still set by every write to the row.
--
-- 2. The folder's child count takes item 42's log. While the database is busy
--    (the same test as update_size()), update_child_count() appends its +1 to
--    "ItemSizeDelta" and returns.
--
-- 3. The charge goes to the folder's drive, through stashly_charge_upload(), and
--    takes the log too. "QuotaDelta" holds charges that haven't reached "Quota".
--    The limit stays strict because "pending" holds every committed charge, so
--    a check can only miss uploads in the same instant:
--      * Far from the limit (used + pending + size * 100 <= total) an upload
--        takes a shared advisory lock on the drive, and logs while busy or
--        charges at once while idle. A logged file is at most 1% of the free
--        space it saw, so up to 100 statements in the same instant can't spend
--        more than is free. KEEP THE MARGIN >= the connections Postgres accepts.
--      * Near the limit it takes that lock exclusively, which waits out the
--        logged uploads in flight, then locks the "Quota" row and charges
--        through a strict check that counts pending. One at a time, as before
--        this migration.
--    A far upload that can't get the shared lock goes the near way.
--
-- apply_item_size_deltas() applies all of it in the one rollup, under the one
-- lock. Deltas are additive, so any mix of logged and direct writes sums exactly.
--
-- Rollback: SELECT * FROM apply_item_size_deltas(NULL, true); re-run
-- update_child_count() from 20251214024737_update_triggers_for_inclusive_counts
-- and apply_item_size_deltas() from 20261030140000_upload_size_delta_log; drop
-- stashly_charge_upload(text, bigint), stashly_quota_status(bigint, bigint),
-- "QuotaDelta" and "ItemSizeDelta"."children"; restore the index.

DROP INDEX "Quota_updatedAt_idx";

ALTER TABLE "ItemSizeDelta" ADD COLUMN "children" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "QuotaDelta" (
    "id" BIGSERIAL NOT NULL,
    "used" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "driveId" TEXT NOT NULL,

    CONSTRAINT "QuotaDelta_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuotaDelta_driveId_idx" ON "QuotaDelta"("driveId");

ALTER TABLE "QuotaDelta" ADD CONSTRAINT "QuotaDelta_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The status a quota row gets for a "used" and "total". The integer thresholds
-- mirror toQuotaStatus() and toQuotaStatusSql() in app/.server/quota-actions.ts.
CREATE OR REPLACE FUNCTION stashly_quota_status(used bigint, total bigint)
RETURNS "QuotaStatus" AS $$
  SELECT (CASE
    WHEN total = 0 THEN CASE WHEN used > 0 THEN 'exceeded' ELSE 'normal' END
    WHEN (used * 1000 / total) > 1000 THEN 'exceeded'
    WHEN (used * 1000 / total) > 990 THEN 'critical'
    WHEN (used * 1000 / total) > 900 THEN 'warning'
    ELSE 'normal'
  END)::"QuotaStatus"
$$ LANGUAGE sql IMMUTABLE;

-- Charges an upload of amount bytes to a drive, and answers whether it may be
-- filed. false writes nothing: the file doesn't fit, or the drive has no quota.
-- Runs inside the upload's statement, so the charge commits with the row.
CREATE OR REPLACE FUNCTION stashly_charge_upload(drive_id text, amount bigint)
RETURNS boolean AS $$
DECLARE
  v_used bigint;
  v_total bigint;
  v_pending bigint;
  v_drive_lock bigint := hashtextextended('stashly.quota_charge:' || drive_id, 0);
  v_log boolean := false;
BEGIN
  -- One statement, one snapshot: read apart, a rollup committing in between
  -- would hide the bytes it moved from "QuotaDelta" to "Quota".
  SELECT q."used", q."total",
         COALESCE((SELECT SUM(d."used") FROM "QuotaDelta" d WHERE d."driveId" = drive_id), 0)::bigint
  INTO v_used, v_total, v_pending
  FROM "Quota" q WHERE q."driveId" = drive_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_used + v_pending + amount * 100 <= v_total
    AND pg_try_advisory_xact_lock_shared(v_drive_lock) THEN
    -- A near-limit charge may have committed since the read above.
    SELECT q."used", q."total",
           COALESCE((SELECT SUM(d."used") FROM "QuotaDelta" d WHERE d."driveId" = drive_id), 0)::bigint
    INTO v_used, v_total, v_pending
    FROM "Quota" q WHERE q."driveId" = drive_id;
    IF v_used + v_pending + amount > v_total THEN
      RETURN false;
    END IF;

    -- Pending deltas first, then the lock: the other order let busy uploads hold
    -- the lock and starved the rollup (20261030160000_upload_size_inline_when_idle).
    IF EXISTS (SELECT 1 FROM "QuotaDelta") OR EXISTS (SELECT 1 FROM "ItemSizeDelta") THEN
      v_log := true;
    ELSIF NOT pg_try_advisory_xact_lock(hashtext('stashly.item_size_rollup')) THEN
      v_log := true;
    END IF;

    IF v_log THEN
      INSERT INTO "QuotaDelta" ("driveId", "used") VALUES (drive_id, amount);
      RETURN true;
    END IF;
  ELSE
    -- Waits out the logged uploads in flight, then for the row, and only then
    -- reads: this statement's snapshot must follow both waits.
    PERFORM pg_advisory_xact_lock(v_drive_lock);
    PERFORM 1 FROM "Quota" q WHERE q."driveId" = drive_id FOR UPDATE;
    SELECT q."used", q."total",
           COALESCE((SELECT SUM(d."used") FROM "QuotaDelta" d WHERE d."driveId" = drive_id), 0)::bigint
    INTO v_used, v_total, v_pending
    FROM "Quota" q WHERE q."driveId" = drive_id;
    IF v_used + v_pending + amount > v_total THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE "Quota" q
  SET "used" = q."used" + amount,
      "status" = stashly_quota_status(q."used" + amount, q."total"),
      -- UTC: the column has no zone and the session's is local.
      "updatedAt" = (now() AT TIME ZONE 'UTC')
  WHERE q."driveId" = drive_id;
  RETURN true;
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

  -- Handle UPDATE
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
    -- If parentId is the same but status changed (item trashed or restored)
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW."parentId" IS NOT NULL THEN
        IF OLD.status = 'trashed' AND NEW.status != 'trashed' THEN -- Restored
          UPDATE "Folder" SET "childCount" = "childCount" + 1 WHERE "itemId" = NEW."parentId";
        ELSIF OLD.status != 'trashed' AND NEW.status = 'trashed' THEN -- Trashed
          UPDATE "Folder" SET "childCount" = "childCount" - 1 WHERE "itemId" = NEW."parentId";
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Applies up to max_deltas pending rows of each log (NULL: all). Returns how many
-- deltas it applied, how many rows it wrote, and how old the oldest applied delta
-- was. wait_for_lock = false (the timer): skip if another run holds the lock,
-- and give up after 100 ms waiting for a row lock, leaving the rows for the
-- next run. wait_for_lock = true (tests, recount): wait for both.
CREATE OR REPLACE FUNCTION apply_item_size_deltas(max_deltas integer DEFAULT 5000, wait_for_lock boolean DEFAULT false)
RETURNS TABLE (deltas integer, ancestors integer, oldest_ms double precision) AS $$
DECLARE
  v_ids text[];
  v_active bigint[];
  v_inclusive bigint[];
  v_child_ids text[];
  v_children integer[];
  v_deltas integer := 0;
  v_quota_deltas integer := 0;
  v_oldest timestamptz;
  v_quota_oldest timestamptz;
  v_written integer := 0;
  v_counted integer := 0;
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

  WITH RECURSIVE claimed AS (
    DELETE FROM "ItemSizeDelta"
    WHERE "id" IN (SELECT "id" FROM "ItemSizeDelta" ORDER BY "id" LIMIT max_deltas)
    RETURNING "parentId", "active", "inclusive", "children", "createdAt"
  ), per_parent AS (
    SELECT "parentId" AS id, SUM("active") AS a, SUM("inclusive") AS i, SUM("children")::integer AS c
    FROM claimed GROUP BY 1
  ), up AS (
    -- A child count stops at its parent, so a row with no bytes walks nothing.
    SELECT id, a, i FROM per_parent WHERE a <> 0 OR i <> 0
    UNION ALL
    SELECT it."parentId", CASE WHEN it."status" = 'trashed' THEN 0 ELSE up.a END, up.i
    FROM up JOIN "Item" it ON it."id" = up.id
    WHERE it."parentId" IS NOT NULL
  ), agg AS (
    SELECT id, SUM(a)::bigint AS a, SUM(i)::bigint AS i FROM up GROUP BY id
  )
  SELECT array_agg(agg.id ORDER BY agg.id), array_agg(agg.a ORDER BY agg.id), array_agg(agg.i ORDER BY agg.id),
         (SELECT array_agg(p.id ORDER BY p.id) FROM per_parent p WHERE p.c <> 0),
         (SELECT array_agg(p.c ORDER BY p.id) FROM per_parent p WHERE p.c <> 0),
         (SELECT COUNT(*) FROM claimed)::integer, (SELECT MIN("createdAt") FROM claimed)
  INTO v_ids, v_active, v_inclusive, v_child_ids, v_children, v_deltas, v_oldest
  FROM agg;

  -- "Folder" before "Item", the order the triggers lock them in on any other
  -- write (item_child_count_* fires before item_size_*): the other order can
  -- deadlock with a folder create, trash or move.
  IF v_child_ids IS NOT NULL THEN
    UPDATE "Folder" f
    SET "childCount" = f."childCount" + u.c,
        "inclusiveChildCount" = f."inclusiveChildCount" + u.c
    FROM unnest(v_child_ids, v_children) AS u(id, c)
    WHERE f."itemId" = u.id;
    GET DIAGNOSTICS v_counted = ROW_COUNT;
  END IF;

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
  RETURN QUERY SELECT v_deltas + v_quota_deltas, v_written + v_counted + v_charged,
    COALESCE(EXTRACT(EPOCH FROM (clock_timestamp() - LEAST(v_oldest, v_quota_oldest))) * 1000, 0)::double precision;
END;
$$ LANGUAGE plpgsql;
