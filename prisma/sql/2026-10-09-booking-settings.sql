-- CreateEnum
CREATE TYPE "CancellationPolicy" AS ENUM ('flexible', 'moderate', 'strict');

-- AlterTable
ALTER TABLE "UnavailableDate" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "BookingSettings" (
    "listingId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "unit" TEXT NOT NULL DEFAULT 'night',
    "rate" DECIMAL(14,2) NOT NULL,
    "cleaningFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cautionDeposit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "minUnits" INTEGER NOT NULL DEFAULT 1,
    "maxUnits" INTEGER NOT NULL DEFAULT 30,
    "maxGuests" INTEGER,
    "instantBook" BOOLEAN NOT NULL DEFAULT true,
    "cancellationPolicy" "CancellationPolicy" NOT NULL DEFAULT 'moderate',
    "checkInTime" TEXT NOT NULL DEFAULT '14:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
    "hoursPerDay" INTEGER,
    "advanceNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSettings_pkey" PRIMARY KEY ("listingId")
);

-- CreateIndex
CREATE INDEX "UnavailableDate_listingId_startDate_idx" ON "UnavailableDate"("listingId", "startDate");

-- AddForeignKey
ALTER TABLE "BookingSettings" ADD CONSTRAINT "BookingSettings_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
