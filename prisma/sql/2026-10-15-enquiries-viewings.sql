-- Phase A: viewing requests on enquiries (replaces the old holding deposit).
-- Additive only; safe to re-run.

ALTER TABLE "Inquiry" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'enquiry',
ADD COLUMN IF NOT EXISTS "preferredDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "preferredTime" TEXT,
ADD COLUMN IF NOT EXISTS "viewingMode" TEXT;
