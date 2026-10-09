-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('property_host', 'fleet_owner', 'marine_operator', 'chauffeur_service', 'security_company', 'brand_retailer', 'agent');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('draft', 'submitted', 'info_requested', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "PartnerApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerType" "PartnerType" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'draft',
    "legalForm" TEXT NOT NULL DEFAULT 'individual',
    "businessName" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "website" TEXT,
    "socialHandle" TEXT,
    "cacNumber" TEXT,
    "collections" TEXT[],
    "about" TEXT NOT NULL DEFAULT '',
    "yearsOperating" INTEGER,
    "declarations" JSONB,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storage" TEXT NOT NULL,
    "blobPathname" TEXT,
    "data" BYTEA,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerApplication_userId_key" ON "PartnerApplication"("userId");

-- CreateIndex
CREATE INDEX "PartnerApplication_status_submittedAt_idx" ON "PartnerApplication"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "PartnerDocument_applicationId_idx" ON "PartnerDocument"("applicationId");

-- AddForeignKey
ALTER TABLE "PartnerDocument" ADD CONSTRAINT "PartnerDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "PartnerApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

