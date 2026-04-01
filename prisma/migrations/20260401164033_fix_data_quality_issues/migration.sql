-- Fix data quality issues identified in data profile audit

-- 1. Fix typo: rename "copyActionIdId" to "copyActionId" on ItemAction
ALTER TABLE "ItemAction" RENAME COLUMN "copyActionIdId" TO "copyActionId";

-- 2. Remove redundant unique index on Item.id (@id already implies uniqueness)
DROP INDEX IF EXISTS "Item_id_key";
