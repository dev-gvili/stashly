-- Add new columns as nullable to allow backfill of existing rows
ALTER TABLE "MoveAction" ADD COLUMN "fromParentId"   TEXT;
ALTER TABLE "MoveAction" ADD COLUMN "fromParentName" TEXT;
ALTER TABLE "MoveAction" ADD COLUMN "toParentId"     TEXT;
ALTER TABLE "MoveAction" ADD COLUMN "toParentName"   TEXT;

-- Backfill from the old from/to columns (they held names after the last update)
UPDATE "MoveAction" SET
  "fromParentId"   = '',
  "fromParentName" = COALESCE("from", ''),
  "toParentId"     = '',
  "toParentName"   = COALESCE("to", '');

-- Enforce NOT NULL now that every row has a value
ALTER TABLE "MoveAction" ALTER COLUMN "fromParentId"   SET NOT NULL;
ALTER TABLE "MoveAction" ALTER COLUMN "fromParentName" SET NOT NULL;
ALTER TABLE "MoveAction" ALTER COLUMN "toParentId"     SET NOT NULL;
ALTER TABLE "MoveAction" ALTER COLUMN "toParentName"   SET NOT NULL;

-- Drop the old columns
ALTER TABLE "MoveAction" DROP COLUMN "from";
ALTER TABLE "MoveAction" DROP COLUMN "to";

-- CopyAction: same pattern (no existing rows, but keep consistent)
ALTER TABLE "CopyAction" ADD COLUMN "fromParentId"   TEXT;
ALTER TABLE "CopyAction" ADD COLUMN "fromParentName" TEXT;
ALTER TABLE "CopyAction" ADD COLUMN "toParentId"     TEXT;
ALTER TABLE "CopyAction" ADD COLUMN "toParentName"   TEXT;

UPDATE "CopyAction" SET
  "fromParentId"   = '',
  "fromParentName" = COALESCE("from", ''),
  "toParentId"     = '',
  "toParentName"   = COALESCE("to", '');

ALTER TABLE "CopyAction" ALTER COLUMN "fromParentId"   SET NOT NULL;
ALTER TABLE "CopyAction" ALTER COLUMN "fromParentName" SET NOT NULL;
ALTER TABLE "CopyAction" ALTER COLUMN "toParentId"     SET NOT NULL;
ALTER TABLE "CopyAction" ALTER COLUMN "toParentName"   SET NOT NULL;

ALTER TABLE "CopyAction" DROP COLUMN "from";
ALTER TABLE "CopyAction" DROP COLUMN "to";
