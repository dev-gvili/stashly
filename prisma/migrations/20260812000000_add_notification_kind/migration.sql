-- Notification.kind — subject/event a notification is about (drives the row glyph).
-- `type` already carries severity (tile colour); this adds the orthogonal subject axis.
-- The model gained `kind` without a migration, so the column was missing in the DB
-- and every notification query failed with "column t0.kind does not exist".

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM (
  'system',
  'share',
  'upload',
  'file',
  'storage',
  'invitation',
  'member',
  'workspace',
  'collection',
  'favorite',
  'pin',
  'comment',
  'lock'
);

-- AlterTable
ALTER TABLE "Notification"
  ADD COLUMN "kind" "NotificationKind" NOT NULL DEFAULT 'system';

-- CreateIndex
CREATE INDEX "Notification_kind_idx" ON "Notification"("kind");
