-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "description" TEXT,
ADD COLUMN     "price" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "BusinessBotConfig" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "welcomeMessage" TEXT,
    "askService" TEXT,
    "askProvider" TEXT,
    "askDate" TEXT,
    "askTime" TEXT,
    "confirmPrompt" TEXT,
    "confirmSuccess" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessBotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessBotConfig_businessId_key" ON "BusinessBotConfig"("businessId");

-- AddForeignKey
ALTER TABLE "BusinessBotConfig" ADD CONSTRAINT "BusinessBotConfig_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
