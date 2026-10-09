-- CreateTable
CREATE TABLE "PartnerAgreement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agreementKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "signedName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerAgreement_signedAt_idx" ON "PartnerAgreement"("signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAgreement_userId_agreementKey_version_key" ON "PartnerAgreement"("userId", "agreementKey", "version");
