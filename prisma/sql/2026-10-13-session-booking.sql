-- Private Services S2: session booking (packages, weekly hours, travel
-- buffer, capacity, areas with travel fees; session details on bookings).
-- Additive only; safe to re-run.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "area" TEXT,
ADD COLUMN IF NOT EXISTS "packageId" TEXT,
ADD COLUMN IF NOT EXISTS "packageName" TEXT,
ADD COLUMN IF NOT EXISTS "serviceNotes" TEXT,
ADD COLUMN IF NOT EXISTS "travelFee" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "BookingSettings" ADD COLUMN IF NOT EXISTS "areas" JSONB,
ADD COLUMN IF NOT EXISTS "bufferMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS "capacity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "workingHours" JSONB;

CREATE TABLE IF NOT EXISTS "ServicePackage" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "durationMinutes" INTEGER NOT NULL,
    "pricing" TEXT NOT NULL DEFAULT 'fixed',
    "price" DECIMAL(14,2) NOT NULL,
    "minGuests" INTEGER NOT NULL DEFAULT 1,
    "maxGuests" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ServicePackage_listingId_active_idx" ON "ServicePackage"("listingId", "active");

DO $$ BEGIN
  ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
