-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('SOURCED', 'ANALYZING', 'QUALIFIED', 'REJECTED', 'UNDER_CONTRACT', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('EMAIL', 'CALL', 'SMS', 'LETTER');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('NO_CONSENT_OBTAINED', 'EXPRESS_WRITTEN_CONSENT', 'PRIOR_EXPRESS_CONSENT', 'DO_NOT_CALL');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('FILTER', 'SCORE_COMPONENT');

-- CreateEnum
CREATE TYPE "Operator" AS ENUM ('GT', 'LT', 'EQ', 'IN', 'CONTAINS', 'RANGE', 'NOT_CONTAINS');

-- CreateEnum
CREATE TYPE "KbCategory" AS ENUM ('ANALYSIS', 'COMPLIANCE', 'FORMULAS', 'MARKET_TRENDS', 'CREATIVE_FINANCE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "propertyType" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "lastSalePrice" DOUBLE PRECISION,
    "lastSaleDate" TIMESTAMP(3),
    "taxAssessedValue" DOUBLE PRECISION,
    "ownershipName" TEXT,
    "ownershipPhone" TEXT,
    "distressSignals" JSONB NOT NULL DEFAULT '{}',
    "dataSource" TEXT NOT NULL DEFAULT 'CSV',
    "dataFreshnessDate" TIMESTAMP(3) NOT NULL,
    "rawData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'SOURCED',
    "stageHistory" JSONB NOT NULL DEFAULT '[]',
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "qualificationScore" INTEGER NOT NULL DEFAULT 0,
    "estimatedProfit" DOUBLE PRECISION,
    "notes" TEXT,
    "pipelinePosition" INTEGER NOT NULL DEFAULT 0,
    "closedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealHistory" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fieldChanged" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactLog" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ownerPhoneEncrypted" TEXT,
    "contactTimestamp" TIMESTAMP(3) NOT NULL,
    "contactMethod" "ContactMethod" NOT NULL,
    "consentStatus" "ConsentStatus" NOT NULL,
    "consentTimestamp" TIMESTAMP(3),
    "consentMedium" TEXT,
    "consentDetails" JSONB NOT NULL DEFAULT '{}',
    "optOutRequestedAt" TIMESTAMP(3),
    "optOutProcessedAt" TIMESTAMP(3),
    "callRecordingUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "ownerPhoneEncrypted" TEXT NOT NULL,
    "originalConsentTimestamp" TIMESTAMP(3) NOT NULL,
    "originalConsentMethod" TEXT NOT NULL,
    "disclosuresAcknowledged" JSONB NOT NULL DEFAULT '[]',
    "revocationTimestamp" TIMESTAMP(3),
    "revocationMethod" TEXT,
    "revocationProcessedDate" TIMESTAMP(3),
    "complianceStatus" TEXT NOT NULL DEFAULT 'COMPLIANT',
    "mustRetainUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoNotCallEntry" (
    "id" TEXT NOT NULL,
    "phoneEncrypted" TEXT NOT NULL,
    "addedReason" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoNotCallEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualificationRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" "RuleType" NOT NULL,
    "fieldName" TEXT NOT NULL,
    "operator" "Operator" NOT NULL,
    "value" JSONB NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleEvaluationLog" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "evaluationResult" TEXT NOT NULL,
    "scoreAwarded" INTEGER NOT NULL DEFAULT 0,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleEvaluationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "KbCategory" NOT NULL,
    "content" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbAccessLog" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KbAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Property_externalId_key" ON "Property"("externalId");

-- CreateIndex
CREATE INDEX "Property_address_city_state_idx" ON "Property"("address", "city", "state");

-- CreateIndex
CREATE INDEX "Property_dataFreshnessDate_idx" ON "Property"("dataFreshnessDate");

-- CreateIndex
CREATE INDEX "Property_externalId_idx" ON "Property"("externalId");

-- CreateIndex
CREATE INDEX "Deal_userId_status_idx" ON "Deal"("userId", "status");

-- CreateIndex
CREATE INDEX "Deal_userId_pipelinePosition_idx" ON "Deal"("userId", "pipelinePosition");

-- CreateIndex
CREATE INDEX "DealHistory_dealId_createdAt_idx" ON "DealHistory"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactLog_propertyId_idx" ON "ContactLog"("propertyId");

-- CreateIndex
CREATE INDEX "ContactLog_userId_contactTimestamp_idx" ON "ContactLog"("userId", "contactTimestamp");

-- CreateIndex
CREATE INDEX "ConsentRecord_ownerPhoneEncrypted_idx" ON "ConsentRecord"("ownerPhoneEncrypted");

-- CreateIndex
CREATE UNIQUE INDEX "DoNotCallEntry_phoneEncrypted_key" ON "DoNotCallEntry"("phoneEncrypted");

-- CreateIndex
CREATE INDEX "DoNotCallEntry_phoneEncrypted_idx" ON "DoNotCallEntry"("phoneEncrypted");

-- CreateIndex
CREATE INDEX "QualificationRule_userId_enabled_idx" ON "QualificationRule"("userId", "enabled");

-- CreateIndex
CREATE INDEX "RuleEvaluationLog_dealId_idx" ON "RuleEvaluationLog"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "KbArticle_slug_key" ON "KbArticle"("slug");

-- CreateIndex
CREATE INDEX "KbArticle_slug_idx" ON "KbArticle"("slug");

-- CreateIndex
CREATE INDEX "KbArticle_category_idx" ON "KbArticle"("category");

-- CreateIndex
CREATE INDEX "KbArticle_isPublished_idx" ON "KbArticle"("isPublished");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealHistory" ADD CONSTRAINT "DealHistory_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealHistory" ADD CONSTRAINT "DealHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationRule" ADD CONSTRAINT "QualificationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleEvaluationLog" ADD CONSTRAINT "RuleEvaluationLog_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleEvaluationLog" ADD CONSTRAINT "RuleEvaluationLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "QualificationRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbAccessLog" ADD CONSTRAINT "KbAccessLog_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KbArticle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbAccessLog" ADD CONSTRAINT "KbAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
