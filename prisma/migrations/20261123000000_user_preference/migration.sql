-- Settings switches (Notifications, AI & privacy): one row per user, booleans,
-- created on the first change; a missing row means the defaults below.

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "notifyComments" BOOLEAN NOT NULL DEFAULT true,
    "notifyShares" BOOLEAN NOT NULL DEFAULT true,
    "notifyAi" BOOLEAN NOT NULL DEFAULT false,
    "notifyWeekly" BOOLEAN NOT NULL DEFAULT true,
    "aiTranscribe" BOOLEAN NOT NULL DEFAULT true,
    "aiCaption" BOOLEAN NOT NULL DEFAULT true,
    "aiIndex" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

