-- Remove orphaned Metadata and Tag tables
-- Neither model had relations to other models or was referenced in application code.

DROP TABLE IF EXISTS "Metadata";
DROP TABLE IF EXISTS "Tag";
