-- Private Services S3: session reminders and "report a concern".
-- Additive only; safe to re-run.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "remindedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "BookingConcern" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingConcern_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BookingConcern_status_createdAt_idx" ON "BookingConcern"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "BookingConcern_bookingId_idx" ON "BookingConcern"("bookingId");

DO $$ BEGIN
  ALTER TABLE "BookingConcern" ADD CONSTRAINT "BookingConcern_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
