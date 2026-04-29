-- CreateTable: Review
CREATE TABLE IF NOT EXISTS "Review" (
  "id"            SERIAL PRIMARY KEY,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "businessId"    INTEGER NOT NULL,
  "appointmentId" INTEGER NOT NULL,
  "rating"        INTEGER,
  "comment"       TEXT,
  "clientName"    TEXT,
  "token"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  CONSTRAINT "Review_appointmentId_key" UNIQUE ("appointmentId"),
  CONSTRAINT "Review_token_key" UNIQUE ("token"),
  CONSTRAINT "Review_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE,
  CONSTRAINT "Review_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE
);
