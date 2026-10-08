-- CreateEnum
CREATE TYPE "ListingMode" AS ENUM ('sale', 'rent', 'booking', 'request');

-- CreateEnum
CREATE TYPE "DigestFrequency" AS ENUM ('daily', 'weekly', 'off');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "mode" "ListingMode" NOT NULL DEFAULT 'sale',
ADD COLUMN     "subcategory" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "luxEdit" "DigestFrequency" NOT NULL DEFAULT 'weekly',
    "partnerDigest" BOOLEAN NOT NULL DEFAULT true,
    "adminBriefing" BOOLEAN NOT NULL DEFAULT true,
    "instantAlerts" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribeToken" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "to" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingView" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT,
    "visitorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchdogRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "checks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchdogRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT,
    "category" "Category",
    "subcategory" TEXT,
    "mode" "ListingMode",
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "payoutTiming" TEXT NOT NULL DEFAULT 'after_checkin',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_unsubscribeToken_key" ON "NotificationPreference"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_userId_kind_createdAt_idx" ON "EmailLog"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "ListingView_listingId_createdAt_idx" ON "ListingView"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "ListingView_userId_createdAt_idx" ON "ListingView"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ListingView_visitorId_listingId_createdAt_idx" ON "ListingView"("visitorId", "listingId", "createdAt");

-- CreateIndex
CREATE INDEX "WatchdogRun_createdAt_idx" ON "WatchdogRun"("createdAt");

-- CreateIndex
CREATE INDEX "CommissionRule_partnerId_idx" ON "CommissionRule"("partnerId");

-- CreateIndex
CREATE INDEX "CommissionRule_category_subcategory_idx" ON "CommissionRule"("category", "subcategory");

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: place existing listings in the new catalogue structure
-- (src/lib/taxonomy.ts). Only rows that have no sub-collection yet.
UPDATE "Listing" SET "subcategory" = 'luxury_shortlets', "mode" = 'booking' WHERE "category" = 'shortlet' AND "subcategory" IS NULL;
UPDATE "Listing" SET "subcategory" = 'chauffeur', "mode" = 'booking' WHERE "category" = 'executive_services' AND "subcategory" IS NULL;
UPDATE "Listing" SET "subcategory" = 'experiences', "mode" = 'request' WHERE "category" = 'lifestyle' AND "subcategory" IS NULL;
UPDATE "Listing" SET "subcategory" = 'for_sale', "mode" = 'sale' WHERE "category" IN ('real_estate', 'supercar', 'yacht', 'commercial', 'decor') AND "subcategory" IS NULL;

-- Commission defaults approved by the founder on 2026-10-08 (adjustable per
-- category or per partner later; each booking stores the rate it used).
-- Mirrors DEFAULT_COMMISSION in src/lib/taxonomy.ts. Only inserted once.
INSERT INTO "CommissionRule" ("id", "subcategory", "mode", "ratePercent", "payoutTiming", "notes", "updatedAt")
SELECT gen_random_uuid()::text, v.subcategory, v.mode::"ListingMode", v.rate, v.timing, v.notes, now()
FROM (VALUES
  ('luxury_shortlets', NULL, 15.00, 'after_checkin', 'Self-managed host. Lux Managed: 20-25% (set per partner).'),
  ('aqua_homes',       NULL, 15.00, 'after_checkin', 'As shortlets.'),
  ('car_rental',       NULL, 18.00, 'after_checkin', 'Chauffeur-driven first; 15-20% range.'),
  ('chauffeur',        NULL, 18.00, 'after_checkin', '15-20% range.'),
  ('close_protection', NULL, 18.00, 'after_completion', '15-20% range; paid after the assignment ends.'),
  ('boat_cruises',     NULL, 13.00, 'after_checkin', '12-15% if the operator holds marine insurance.'),
  ('for_rent',         NULL,  5.00, 'on_completion_of_sale', 'Max 5% of annual rent (Lagos tenancy reform).'),
  (NULL,             'sale',  3.00, 'on_completion_of_sale', 'Success fee; negotiate per deal or Lux Partner Pro subscription.')
) AS v(subcategory, mode, rate, timing, notes)
WHERE NOT EXISTS (SELECT 1 FROM "CommissionRule");
