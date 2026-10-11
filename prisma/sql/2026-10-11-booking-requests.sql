-- On-request bookings (requested/declined), guest ID upload, and resumable
-- payment links. Additive only; safe to re-run.
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'requested';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'declined';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "declineReason" TEXT,
ADD COLUMN IF NOT EXISTS "guestIdData" BYTEA,
ADD COLUMN IF NOT EXISTS "guestIdPath" TEXT,
ADD COLUMN IF NOT EXISTS "guestIdStorage" TEXT,
ADD COLUMN IF NOT EXISTS "guestIdType" TEXT,
ADD COLUMN IF NOT EXISTS "guestIdUploadedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paymentUrl" TEXT;

-- AlterTable
ALTER TABLE "BookingSettings" ADD COLUMN IF NOT EXISTS "requireGuestId" BOOLEAN NOT NULL DEFAULT true;
