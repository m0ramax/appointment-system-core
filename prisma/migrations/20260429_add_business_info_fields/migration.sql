-- AlterTable: add info fields to Business
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "phone"       TEXT,
  ADD COLUMN IF NOT EXISTS "address"     TEXT,
  ADD COLUMN IF NOT EXISTS "logoUrl"     TEXT;
