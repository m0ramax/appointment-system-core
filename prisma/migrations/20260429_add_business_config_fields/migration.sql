-- AlterTable: add config fields to Business
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "slug"                 TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappWelcome"      TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappConfirmation" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappCancellation" TEXT,
  ADD COLUMN IF NOT EXISTS "appointmentDuration"  INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "timezone"             TEXT    NOT NULL DEFAULT 'America/Santiago';

-- CreateIndex: unique slug
CREATE UNIQUE INDEX IF NOT EXISTS "Business_slug_key" ON "Business"("slug");
