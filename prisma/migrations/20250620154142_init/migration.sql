-- CreateEnum
CREATE TYPE "ObjectType" AS ENUM ('file', 'folder');

-- CreateEnum
CREATE TYPE "DriveType" AS ENUM ('personal', 'business');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('folder', 'file', 'collection', 'image', 'video', 'audio', 'photo');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('video', 'audio', 'image', 'document', 'spreadsheet', 'presentation', 'text', 'pdf', 'archive', 'code', 'script', 'binaries', 'graphic', 'unknown');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('normal', 'archived', 'trashed');

-- CreateEnum
CREATE TYPE "PermissionRole" AS ENUM ('owner', 'read', 'write');

-- CreateEnum
CREATE TYPE "QuotaState" AS ENUM ('normal', 'nearing', 'critical', 'exceeded');

-- CreateEnum
CREATE TYPE "ShareLinkType" AS ENUM ('view', 'edit', 'embed', 'upload');

-- CreateEnum
CREATE TYPE "ShareScope" AS ENUM ('anonymous', 'organization', 'users');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('free', 'paid', 'trial');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('free', 'basic', 'pro', 'enterprise');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('monthly', 'quarterly', 'annual');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('succeeded', 'failed', 'pending', 'refunded');

-- CreateEnum
CREATE TYPE "ThumbnailSize" AS ENUM ('small', 'medium', 'large', 'custom');

-- CreateEnum
CREATE TYPE "WorkspaceMemberRole" AS ENUM ('viewer', 'member', 'admin', 'owner');

-- CreateEnum
CREATE TYPE "ViewType" AS ENUM ('list', 'grid', 'details', 'gallery');

-- CreateEnum
CREATE TYPE "SortBy" AS ENUM ('name', 'date', 'size', 'type');

-- CreateEnum
CREATE TYPE "SortOrder" AS ENUM ('ascending', 'descending');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAction" (
    "id" TEXT NOT NULL,
    "commentActionId" TEXT,
    "createActionId" TEXT,
    "deleteActionId" TEXT,
    "editActionId" TEXT,
    "moveActionId" TEXT,
    "renameActionId" TEXT,
    "restoreActionId" TEXT,
    "shareActionId" TEXT,
    "versionActionId" TEXT,
    "activityId" TEXT,

    CONSTRAINT "ItemAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessAction" (
    "id" TEXT NOT NULL,
    "activityId" TEXT,

    CONSTRAINT "AccessAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentAction" (
    "id" TEXT NOT NULL,
    "isReply" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "participants" TEXT[],

    CONSTRAINT "CommentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreateAction" (
    "id" TEXT NOT NULL,

    CONSTRAINT "CreateAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeleteAction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "itemType" "ObjectType" NOT NULL,

    CONSTRAINT "DeleteAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditAction" (
    "id" TEXT NOT NULL,

    CONSTRAINT "EditAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoveAction" (
    "id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,

    CONSTRAINT "MoveAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenameAction" (
    "id" TEXT NOT NULL,
    "oldName" TEXT NOT NULL,
    "newName" TEXT NOT NULL,

    CONSTRAINT "RenameAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestoreAction" (
    "id" TEXT NOT NULL,

    CONSTRAINT "RestoreAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareAction" (
    "id" TEXT NOT NULL,
    "recipients" TEXT[],

    CONSTRAINT "ShareAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersionAction" (
    "id" TEXT NOT NULL,
    "newVersion" TEXT NOT NULL,

    CONSTRAINT "VersionAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "timeId" TEXT,
    "itemId" TEXT,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityTime" (
    "id" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),

    CONSTRAINT "ActivityTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drive" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Any Drive',
    "driveType" "DriveType" NOT NULL DEFAULT 'personal',
    "quotaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Drive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "mimeType" TEXT,
    "hash" TEXT,
    "extension" TEXT,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "etag" TEXT,
    "iamRoleArn" TEXT,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "childCount" INTEGER,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "height" INTEGER,
    "width" INTEGER,
    "horizontalResolution" INTEGER,
    "verticalResolution" INTEGER,
    "cameraMake" TEXT,
    "cameraModel" TEXT,
    "exposureDenominator" DOUBLE PRECISION,
    "exposureNumerator" DOUBLE PRECISION,
    "focalLength" DOUBLE PRECISION,
    "fNumber" DOUBLE PRECISION,
    "iso" INTEGER,
    "takenDateTime" TIMESTAMP(3),

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "bitrate" INTEGER,
    "duration" INTEGER,
    "height" INTEGER,
    "width" INTEGER,
    "audioBitsPerSample" INTEGER,
    "audioChannels" INTEGER,
    "audioFormat" TEXT,
    "audioSamplesPerSecond" INTEGER,
    "frameRate" DOUBLE PRECISION,
    "fourCC" TEXT,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audio" (
    "id" TEXT NOT NULL,
    "album" TEXT,
    "albumArtist" TEXT,
    "artist" TEXT,
    "bitrate" INTEGER,
    "composers" TEXT,
    "copyright" TEXT,
    "disc" INTEGER,
    "discCount" INTEGER,
    "duration" INTEGER,
    "genre" TEXT,
    "hasDrm" BOOLEAN,
    "isVariableBitrate" BOOLEAN,
    "title" TEXT,
    "track" INTEGER,
    "trackCount" INTEGER,
    "year" INTEGER,

    CONSTRAINT "Audio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "cameraMake" TEXT,
    "cameraModel" TEXT,
    "exposureDenominator" DOUBLE PRECISION,
    "exposureNumerator" DOUBLE PRECISION,
    "fNumber" DOUBLE PRECISION,
    "focalLength" DOUBLE PRECISION,
    "iso" INTEGER,
    "takenDateTime" TIMESTAMP(3),

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "favoritedById" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP,
    "email" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "senderId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "role" "WorkspaceMemberRole",

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT NOT NULL,
    "type" "ItemType" NOT NULL DEFAULT 'file',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "deletedAt" TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "driveId" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metadata" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "roles" "PermissionRole" NOT NULL DEFAULT 'read',
    "invitationId" TEXT,
    "linkId" TEXT,
    "itemId" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quota" (
    "id" TEXT NOT NULL,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "remaining" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "used" INTEGER NOT NULL DEFAULT 0,
    "state" "QuotaState" NOT NULL DEFAULT 'normal',
    "driveId" TEXT NOT NULL,

    CONSTRAINT "Quota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Search" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,
    "activeWorkspaceId" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "type" "ShareLinkType" NOT NULL,
    "scope" "ShareScope" NOT NULL,
    "url" TEXT,
    "downloadable" BOOLEAN,
    "password" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "type" "SubscriptionType" NOT NULL DEFAULT 'free',
    "plan" "PlanType" NOT NULL DEFAULT 'free',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interval" "BillingInterval" NOT NULL DEFAULT 'monthly',
    "paymentMethod" TEXT,
    "lastPaymentDate" TIMESTAMP(3),
    "nextBillingDate" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "previousPlan" "PlanType",
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscriptionId" TEXT NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanChange" (
    "id" TEXT NOT NULL,
    "fromPlan" "PlanType" NOT NULL,
    "toPlan" "PlanType" NOT NULL,
    "reason" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscriptionId" TEXT NOT NULL,

    CONSTRAINT "PlanChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Thumbnail" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "url" TEXT,
    "content" BYTEA,
    "size" "ThumbnailSize" NOT NULL DEFAULT 'custom',
    "itemId" TEXT,

    CONSTRAINT "Thumbnail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trash" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "Trash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrashItem" (
    "itemId" TEXT NOT NULL,
    "trashId" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" TIMESTAMP,
    "deletedAt" TIMESTAMP
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "displayName" TEXT,
    "email" TEXT NOT NULL,
    "image" TEXT,
    "emailVerified" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT,
    "bucket" TEXT NOT NULL DEFAULT 'default-bucket',

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVersion" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "size" INTEGER,
    "content" BYTEA,
    "label" TEXT,
    "version" TEXT,
    "itemId" TEXT,

    CONSTRAINT "ItemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "default" BOOLEAN NOT NULL DEFAULT false,
    "iamRoleArn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "role" "WorkspaceMemberRole" NOT NULL DEFAULT 'member',
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preview" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileShare" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxDownloads" INTEGER,
    "downloads" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FileShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemLock" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lockedById" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "View" (
    "id" TEXT NOT NULL,
    "viewType" "ViewType" NOT NULL,
    "sortBy" "SortBy" NOT NULL,
    "sortOrder" "SortOrder" NOT NULL,
    "folderId" TEXT,

    CONSTRAINT "View_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ItemToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ItemToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PermissionToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PermissionToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemAction_commentActionId_key" ON "ItemAction"("commentActionId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAction_createActionId_key" ON "ItemAction"("createActionId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAction_deleteActionId_key" ON "ItemAction"("deleteActionId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAction_editActionId_key" ON "ItemAction"("editActionId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAction_moveActionId_key" ON "ItemAction"("moveActionId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAction_renameActionId_key" ON "ItemAction"("renameActionId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAction_restoreActionId_key" ON "ItemAction"("restoreActionId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAction_shareActionId_key" ON "ItemAction"("shareActionId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAction_versionActionId_key" ON "ItemAction"("versionActionId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAction_activityId_key" ON "ItemAction"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessAction_activityId_key" ON "AccessAction"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_timeId_key" ON "Activity"("timeId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "Collection_name_idx" ON "Collection"("name");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionItem_itemId_idx" ON "CollectionItem"("itemId");

-- CreateIndex
CREATE INDEX "CollectionItem_createdAt_idx" ON "CollectionItem"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collectionId_itemId_key" ON "CollectionItem"("collectionId", "itemId");

-- CreateIndex
CREATE INDEX "Comment_createdAt_idx" ON "Comment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Drive_quotaId_key" ON "Drive"("quotaId");

-- CreateIndex
CREATE INDEX "Drive_name_idx" ON "Drive"("name");

-- CreateIndex
CREATE INDEX "Drive_driveType_idx" ON "Drive"("driveType");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_favoritedById_itemId_key" ON "Favorite"("favoritedById", "itemId");

-- CreateIndex
CREATE INDEX "Item_type_idx" ON "Item"("type");

-- CreateIndex
CREATE INDEX "Item_name_idx" ON "Item"("name" ASC);

-- CreateIndex
CREATE INDEX "Item_workspaceId_idx" ON "Item"("workspaceId");

-- CreateIndex
CREATE INDEX "Item_createdAt_idx" ON "Item"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "Item_updatedAt_idx" ON "Item"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_invitationId_key" ON "Permission"("invitationId");

-- CreateIndex
CREATE INDEX "Permission_createdAt_idx" ON "Permission"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Permission_updatedAt_idx" ON "Permission"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Permission_roles_idx" ON "Permission"("roles");

-- CreateIndex
CREATE INDEX "Permission_invitationId_idx" ON "Permission"("invitationId");

-- CreateIndex
CREATE INDEX "Permission_linkId_idx" ON "Permission"("linkId");

-- CreateIndex
CREATE INDEX "Permission_itemId_idx" ON "Permission"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Quota_driveId_key" ON "Quota"("driveId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "ShareLink_createdAt_idx" ON "ShareLink"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ShareLink_updatedAt_idx" ON "ShareLink"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "ShareLink_expiresAt_idx" ON "ShareLink"("expiresAt");

-- CreateIndex
CREATE INDEX "ShareLink_type_idx" ON "ShareLink"("type");

-- CreateIndex
CREATE INDEX "ShareLink_scope_idx" ON "ShareLink"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrashItem_itemId_key" ON "TrashItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "TrashItem_itemId_trashId_key" ON "TrashItem"("itemId", "trashId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_name_idx" ON "user"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_name_key" ON "Workspace"("name");

-- CreateIndex
CREATE INDEX "Workspace_name_idx" ON "Workspace"("name");

-- CreateIndex
CREATE INDEX "Workspace_default_idx" ON "Workspace"("default");

-- CreateIndex
CREATE INDEX "Workspace_createdAt_idx" ON "Workspace"("createdAt");

-- CreateIndex
CREATE INDEX "Workspace_updatedAt_idx" ON "Workspace"("updatedAt");

-- CreateIndex
CREATE INDEX "WorkspaceMember_role_idx" ON "WorkspaceMember"("role");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_userId_workspaceId_key" ON "WorkspaceMember"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "FileShare_accessKey_key" ON "FileShare"("accessKey");

-- CreateIndex
CREATE INDEX "FileShare_expiresAt_idx" ON "FileShare"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ItemLock_itemId_key" ON "ItemLock"("itemId");

-- CreateIndex
CREATE INDEX "ItemLock_expiresAt_idx" ON "ItemLock"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "View_folderId_key" ON "View"("folderId");

-- CreateIndex
CREATE INDEX "_ItemToTag_B_index" ON "_ItemToTag"("B");

-- CreateIndex
CREATE INDEX "_PermissionToUser_B_index" ON "_PermissionToUser"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_commentActionId_fkey" FOREIGN KEY ("commentActionId") REFERENCES "CommentAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_createActionId_fkey" FOREIGN KEY ("createActionId") REFERENCES "CreateAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_deleteActionId_fkey" FOREIGN KEY ("deleteActionId") REFERENCES "DeleteAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_editActionId_fkey" FOREIGN KEY ("editActionId") REFERENCES "EditAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_moveActionId_fkey" FOREIGN KEY ("moveActionId") REFERENCES "MoveAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_renameActionId_fkey" FOREIGN KEY ("renameActionId") REFERENCES "RenameAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_restoreActionId_fkey" FOREIGN KEY ("restoreActionId") REFERENCES "RestoreAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_shareActionId_fkey" FOREIGN KEY ("shareActionId") REFERENCES "ShareAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_versionActionId_fkey" FOREIGN KEY ("versionActionId") REFERENCES "VersionAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessAction" ADD CONSTRAINT "AccessAction_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_timeId_fkey" FOREIGN KEY ("timeId") REFERENCES "ActivityTime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_id_fkey" FOREIGN KEY ("id") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_id_fkey" FOREIGN KEY ("id") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_id_fkey" FOREIGN KEY ("id") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_id_fkey" FOREIGN KEY ("id") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_id_fkey" FOREIGN KEY ("id") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audio" ADD CONSTRAINT "Audio_id_fkey" FOREIGN KEY ("id") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_id_fkey" FOREIGN KEY ("id") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_favoritedById_fkey" FOREIGN KEY ("favoritedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ShareLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quota" ADD CONSTRAINT "Quota_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanChange" ADD CONSTRAINT "PlanChange_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thumbnail" ADD CONSTRAINT "Thumbnail_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrashItem" ADD CONSTRAINT "TrashItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrashItem" ADD CONSTRAINT "TrashItem_trashId_fkey" FOREIGN KEY ("trashId") REFERENCES "Trash"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVersion" ADD CONSTRAINT "ItemVersion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLock" ADD CONSTRAINT "ItemLock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "View" ADD CONSTRAINT "View_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemToTag" ADD CONSTRAINT "_ItemToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItemToTag" ADD CONSTRAINT "_ItemToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToUser" ADD CONSTRAINT "_PermissionToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToUser" ADD CONSTRAINT "_PermissionToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
