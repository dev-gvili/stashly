-- A permanent delete writes each surviving folder once, not once per deleted
-- row (the delete half of tech-debt item 51).
--
-- The per-row DELETE triggers (item_size_decrement → update_size(),
-- item_child_count_delete → update_child_count()) wrote the parent of every
-- deleted row, one row at a time, and each rewrite of the same row costs more
-- than the last: deleting 20,000 files from one folder spent 33.3 s in
-- update_size and 6.6 s in update_child_count of a 54.5 s statement (measured
-- 23 Nov on a throwaway database, 60,000 calls each).
--
-- This statement-level trigger sums the deleted rows per surviving parent and
-- hands the totals to stashly_apply_folder_deltas(), the walk the status-change
-- trigger and the size rollup already use: each folder once, "Folder" before
-- "Item", ancestors deepest first, a trashed ancestor stopping the active walk.
--
-- A deleted row whose parent went in the same delete counts for nothing: that
-- parent is gone. Those rows are dropped with GROUP BY, never a join or an
-- ANY() over the deleted ids: plpgsql keeps its first plan, and both forms can
-- turn quadratic at 20,000 rows (item 51). Rows removed by the parentId cascade
-- arrive in their own statements, whose parents are gone too, so no
-- pg_trigger_depth() guard is needed or wanted.
--
-- update_size() and update_child_count() keep their DELETE branches, now
-- reached by no trigger; they still serve INSERT and UPDATE.

CREATE OR REPLACE FUNCTION stashly_delete_rollup()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ids text[];
  v_active bigint[];
  v_inclusive bigint[];
  v_children integer[];
  v_inclusive_children integer[];
BEGIN
  -- The rollup never deletes, but its writes must not cascade either way.
  IF current_setting('stashly.rollup', true) = 'on' THEN
    RETURN NULL;
  END IF;

  WITH sides AS (
    -- What each deleted row takes from its parent, as update_size() and
    -- update_child_count() computed it per row.
    SELECT "parentId" AS id,
      CASE WHEN "status" <> 'trashed' THEN COALESCE("size", 0) ELSE 0 END AS a,
      CASE WHEN "type" = 'folder' THEN COALESCE("inclusiveSize", 0) ELSE COALESCE("size", 0) END AS i,
      CASE WHEN "status" <> 'trashed' THEN 1 ELSE 0 END AS c,
      1 AS ic,
      false AS gone
    FROM deleted_old
    WHERE "parentId" IS NOT NULL
    UNION ALL
    -- Every deleted row, marking its id as gone.
    SELECT "id", 0, 0, 0, 0, true FROM deleted_old
  ), per_parent AS (
    SELECT id, SUM(a)::bigint AS a, SUM(i)::bigint AS i, SUM(c)::integer AS c, SUM(ic)::integer AS ic
    FROM sides
    GROUP BY id
    HAVING NOT bool_or(gone)
  )
  SELECT array_agg(id ORDER BY id), array_agg(-a ORDER BY id), array_agg(-i ORDER BY id),
         array_agg(-c ORDER BY id), array_agg(-ic ORDER BY id)
  INTO v_ids, v_active, v_inclusive, v_children, v_inclusive_children
  FROM per_parent;

  IF v_ids IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM set_config('stashly.rollup', 'on', true);
  PERFORM stashly_apply_folder_deltas(v_ids, v_active, v_inclusive, v_children, v_inclusive_children);
  PERFORM set_config('stashly.rollup', 'off', true);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS item_size_decrement ON "Item";
DROP TRIGGER IF EXISTS item_child_count_delete ON "Item";

CREATE TRIGGER item_delete_rollup
AFTER DELETE ON "Item"
REFERENCING OLD TABLE AS deleted_old
FOR EACH STATEMENT
EXECUTE FUNCTION stashly_delete_rollup();
