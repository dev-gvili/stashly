-- Split "Transcribe audio & video" into two switches. aiTranscribe now means
-- audio only; aiTranscribeVideo starts from each user's current value, so a
-- user who turned transcription off keeps video off too.
ALTER TABLE "UserPreference" ADD COLUMN "aiTranscribeVideo" BOOLEAN NOT NULL DEFAULT true;

UPDATE "UserPreference" SET "aiTranscribeVideo" = "aiTranscribe";
