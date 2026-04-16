-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "teamMode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
