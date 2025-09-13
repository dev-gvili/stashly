-- DropIndex
DROP INDEX "Search_vector_idx";

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "id" SET DEFAULT (concat('subs_', encode(substr(sha256(random()::text::bytea), 0, 12), 'base64')));

-- AlterTable
ALTER TABLE "Tag" ALTER COLUMN "id" SET DEFAULT (concat('tag_', encode(substr(sha256(random()::text::bytea), 0, 12), 'base64')));
