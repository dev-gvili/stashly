-- Sign in to enable AI completions, or disable inline completions in Settings (DBCode > AI).
-- Remove old update parent folder size functions --

-- Create new 
CREATE OR REPLACE FUNCTION update_size()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle DELETE: decrement old parent
  IF TG_OP = 'DELETE' THEN
    IF OLD."parentId" IS NOT NULL AND OLD."size" IS NOT NULL THEN
      UPDATE "Item"
      SET "size" = "size" - OLD."size"
      WHERE "id" = OLD."parentId";
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT: increment new parent
  IF TG_OP = 'INSERT' THEN
    IF NEW."parentId" IS NOT NULL AND NEW."size" IS NOT NULL THEN
      UPDATE "Item"
      SET "size" = "size" + NEW."size"
      WHERE "id" = NEW."parentId";
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE: parentId or size changed
  IF TG_OP = 'UPDATE' THEN
    IF (OLD."parentId" IS DISTINCT FROM NEW."parentId") OR (OLD."size" IS DISTINCT FROM NEW."size") THEN
      -- Decrement old parent
      IF OLD."parentId" IS NOT NULL AND OLD."size" IS NOT NULL THEN
        UPDATE "Item"
        SET "size" = "size" - OLD."size"
        WHERE "id" = OLD."parentId";
      END IF;
      -- Increment new parent
      IF NEW."parentId" IS NOT NULL AND NEW."size" IS NOT NULL THEN
        UPDATE "Item"
        SET "size" = "size" + NEW."size"
        WHERE "id" = NEW."parentId";
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