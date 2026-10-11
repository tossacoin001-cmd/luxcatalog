-- Private Services (S1): the new category, the Service Professional partner
-- type, and admin price floors. Additive only; safe to re-run.

ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'private_services';
ALTER TYPE "PartnerType" ADD VALUE IF NOT EXISTS 'service_professional';

CREATE TABLE IF NOT EXISTS "ServicePriceFloor" (
    "subcategory" TEXT NOT NULL,
    "minPrice" DECIMAL(14,2) NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePriceFloor_pkey" PRIMARY KEY ("subcategory")
);
