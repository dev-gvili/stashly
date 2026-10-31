-- Each upload gets its own object key (`<root>/<itemId>/<name>`, `toObjectKey`),
-- so two uploads of one name no longer share, and overwrite, one object. The
-- folders the upload named move to "uploadPath". Every key written before this
-- was that path, so it is copied over.
ALTER TABLE "File" ADD COLUMN "uploadPath" TEXT;
UPDATE "File" SET "uploadPath" = "key";
ALTER TABLE "File" ALTER COLUMN "uploadPath" SET NOT NULL;
