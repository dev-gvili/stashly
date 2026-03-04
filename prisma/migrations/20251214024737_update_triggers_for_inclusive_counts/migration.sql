-- This migration updates the trigger functions to correctly handle the new
-- 'inclusiveSize' and 'inclusiveChildCount' columns, ensuring that both
-- active and total counts/sizes are maintained for parent items.

-- 1. Update the 'update_child_count' function
CREATE OR REPLACE FUNCTION update_child_count()
RETURNS TRIGGER AS $$
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

-- 2. Update the 'update_size' function
CREATE OR REPLACE FUNCTION update_size()
RETURNS TRIGGER AS $$
DECLARE
  old_contrib BIGINT;
  new_contrib BIGINT;
  size_diff_inclusive BIGINT;
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD."parentId" IS NOT NULL AND OLD.size > 0 THEN
      UPDATE "Item"
      SET 
        "inclusiveSize" = "inclusiveSize" - OLD.size,
        "size" = CASE WHEN OLD.status != 'trashed' THEN "size" - OLD.size ELSE "size" END
      WHERE "id" = OLD."parentId";
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    IF NEW."parentId" IS NOT NULL AND NEW.size > 0 THEN
      UPDATE "Item"
      SET
        "inclusiveSize" = "inclusiveSize" + NEW.size,
        "size" = CASE WHEN NEW.status != 'trashed' THEN "size" + NEW.size ELSE "size" END
      WHERE "id" = NEW."parentId";
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- If parentId changed (item moved)
    IF OLD."parentId" IS DISTINCT FROM NEW."parentId" THEN
      -- Decrement counts for the old parent
      IF OLD."parentId" IS NOT NULL AND OLD.size > 0 THEN
        UPDATE "Item"
        SET
          "inclusiveSize" = "inclusiveSize" - OLD.size,
          "size" = CASE WHEN OLD.status != 'trashed' THEN "size" - OLD.size ELSE "size" END
        WHERE "id" = OLD."parentId";
      END IF;
      -- Increment counts for the new parent
      IF NEW."parentId" IS NOT NULL AND NEW.size > 0 THEN
        UPDATE "Item"
        SET
          "inclusiveSize" = "inclusiveSize" + NEW.size,
          "size" = CASE WHEN NEW.status != 'trashed' THEN "size" + NEW.size ELSE "size" END
        WHERE "id" = NEW."parentId";
      END IF;
    -- If parentId is the same but status or size changed
    ELSIF OLD.size IS DISTINCT FROM NEW.size OR OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW."parentId" IS NOT NULL THEN
        old_contrib := CASE WHEN OLD.status != 'trashed' THEN COALESCE(OLD.size, 0) ELSE 0 END;
        new_contrib := CASE WHEN NEW.status != 'trashed' THEN COALESCE(NEW.size, 0) ELSE 0 END;
        size_diff_inclusive := COALESCE(NEW.size, 0) - COALESCE(OLD.size, 0);

        -- Apply the deltas if there's any change to apply
        IF size_diff_inclusive != 0 OR (new_contrib - old_contrib) != 0 THEN
            UPDATE "Item"
            SET
              "inclusiveSize" = "inclusiveSize" + size_diff_inclusive,
              "size" = "size" + (new_contrib - old_contrib)
            WHERE "id" = NEW."parentId";
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
