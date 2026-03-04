-- Sign in to enable AI completions, or disable inline completions in Settings (DBCode > AI).
-- Remove old update parent folder size functions --

-- Create new 
CREATE OR REPLACE FUNCTION update_size()
RETURNS TRIGGER AS $$
DECLARE
  old_contrib BIGINT;
  new_contrib BIGINT;
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    old_contrib := CASE WHEN OLD.status != 'trashed' THEN COALESCE(OLD.size, 0) ELSE 0 END;
    IF OLD."parentId" IS NOT NULL AND old_contrib > 0 THEN
      UPDATE "Item" SET "size" = "size" - old_contrib WHERE "id" = OLD."parentId";
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    new_contrib := CASE WHEN NEW.status != 'trashed' THEN COALESCE(NEW.size, 0) ELSE 0 END;
    IF NEW."parentId" IS NOT NULL AND new_contrib > 0 THEN
      UPDATE "Item" SET "size" = "size" + new_contrib WHERE "id" = NEW."parentId";
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    old_contrib := CASE WHEN OLD.status != 'trashed' THEN COALESCE(OLD.size, 0) ELSE 0 END;
    new_contrib := CASE WHEN NEW.status != 'trashed' THEN COALESCE(NEW.size, 0) ELSE 0 END;

    -- If item was moved
    IF OLD."parentId" IS DISTINCT FROM NEW."parentId" THEN
      -- Decrement old parent
      IF OLD."parentId" IS NOT NULL AND old_contrib > 0 THEN
        UPDATE "Item" SET "size" = "size" - old_contrib WHERE "id" = OLD."parentId";
      END IF;
      -- Increment new parent
      IF NEW."parentId" IS NOT NULL AND new_contrib > 0 THEN
        UPDATE "Item" SET "size" = "size" + new_contrib WHERE "id" = NEW."parentId";
      END IF;
    -- If item was not moved, but its contribution to parent size changed
    ELSIF old_contrib != new_contrib THEN
      IF NEW."parentId" IS NOT NULL THEN
        UPDATE "Item" SET "size" = "size" + (new_contrib - old_contrib) WHERE "id" = NEW."parentId";
      END IF;
    END IF;
    
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "category" TYPE "ItemCategory" NOT NULL DEFAULT 'unknown';

DROP FUNCTION IF EXISTS update_parent_folder_size() CASCADE;

DROP TRIGGER IF EXISTS item_size_update ON "Item";
DROP TRIGGER IF EXISTS item_size_decrement ON "Item";
DROP TRIGGER IF EXISTS item_size_update_on_update ON "Item";

CREATE TRIGGER item_size_update
AFTER INSERT ON "Item"
FOR EACH ROW
EXECUTE FUNCTION update_size();

CREATE TRIGGER item_size_update_on_update
AFTER UPDATE ON "Item"
FOR EACH ROW
EXECUTE FUNCTION update_size();

CREATE TRIGGER item_size_decrement
AFTER DELETE ON "Item"
FOR EACH ROW
EXECUTE FUNCTION update_size();
COMMIT;