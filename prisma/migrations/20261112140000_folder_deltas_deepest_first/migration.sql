-- stashly_apply_folder_deltas() locks the ancestors deepest first (tech-debt item 93).
--
-- It locked every affected folder's "Item" row in id order. The per-row size
-- cascade (update_size(), from a copy, move, delete or idle upload) locks the
-- same rows bottom-up along a chain. Ids are random, so on a shared chain the
-- two orders run head-on about half the time per pair of ancestors, and with a
-- third transaction holding a middle one a trash and a copy deadlocked (40P01,
-- 10 of 10 with the ids ascending from the root; 0 of 10 the other way).
--
-- The "Item" rows are now locked by absolute depth, deepest first, ties by id.
-- A descendant is always deeper than its ancestors, so every chain is taken in
-- the cascade's order, and the order is the same in every call whatever folders
-- it started from, so two calls can't take two unrelated folders in opposite
-- orders. (Ordering by the longest path within one walk agreed with the
-- cascade but not across calls: a global order needs the depth from the root.)
-- The depth is one upward walk per affected folder, a few steps for a normal
-- tree. The "Folder" rows (child counts, direct parents only) keep id order and
-- stay before the "Item" rows, as before. Nothing else in the function changes.

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
  ), anc AS (
    -- Each folder's absolute depth: its steps up to the root.
    SELECT id AS start, id AS cur FROM agg
    UNION ALL
    SELECT anc.start, it."parentId" FROM anc JOIN "Item" it ON it."id" = anc.cur
    WHERE it."parentId" IS NOT NULL
  ), depth AS (
    SELECT start AS id, COUNT(*) AS d FROM anc GROUP BY start
  )
  SELECT array_agg(agg.id ORDER BY depth.d DESC, agg.id), array_agg(agg.a ORDER BY depth.d DESC, agg.id), array_agg(agg.i ORDER BY depth.d DESC, agg.id)
  INTO v_ids, v_active, v_inclusive
  FROM agg JOIN depth ON depth.id = agg.id;

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
    -- Deepest first, in the array's order (a plain ANY() lock would be id order).
    PERFORM 1 FROM unnest(v_ids) WITH ORDINALITY AS o(id, ord)
      JOIN "Item" i ON i."id" = o.id
      ORDER BY o.ord
      FOR NO KEY UPDATE OF i;
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
