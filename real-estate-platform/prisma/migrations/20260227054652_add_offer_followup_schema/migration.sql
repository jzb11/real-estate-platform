-- CreateEnum
CREATE TYPE "SendgridEventType" AS ENUM ('DELIVERED', 'OPEN', 'CLICK', 'BOUNCE', 'COMPLAINT', 'UNSUBSCRIBE', 'GROUP_UNSUBSCRIBE');

-- CreateEnum
CREATE TYPE "OfferedDealStatus" AS ENUM ('DRAFT', 'SENT', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED');

-- CreateTable
CREATE TABLE "OfferedDeal" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sentToEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "status" "OfferedDealStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL,
    "emailOpenedAt" TIMESTAMP(3),
    "linkClickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "bouncetype" TEXT,
    "complaintType" TEXT,
    "sendgridMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferedDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendgridWebhook" (
    "id" TEXT NOT NULL,
    "eventType" "SendgridEventType" NOT NULL,
    "email" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "messageId" TEXT,
    "bounceType" TEXT,
    "complaintType" TEXT,
    "url" TEXT,
    "rawPayload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SendgridWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpSequence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "steps" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpScheduled" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "nextStepAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpScheduled_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpEvent" (
    "id" TEXT NOT NULL,
    "scheduledId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "content" JSONB,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfferedDeal_userId_sentAt_idx" ON "OfferedDeal"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "OfferedDeal_dealId_idx" ON "OfferedDeal"("dealId");

-- CreateIndex
CREATE INDEX "OfferedDeal_status_idx" ON "OfferedDeal"("status");

-- CreateIndex
CREATE INDEX "SendgridWebhook_messageId_idx" ON "SendgridWebhook"("messageId");

-- CreateIndex
CREATE INDEX "SendgridWebhook_email_timestamp_idx" ON "SendgridWebhook"("email", "timestamp");

-- CreateIndex
CREATE INDEX "SendgridWebhook_eventType_idx" ON "SendgridWebhook"("eventType");

-- CreateIndex
CREATE INDEX "FollowUpSequence_userId_enabled_idx" ON "FollowUpSequence"("userId", "enabled");

-- CreateIndex
CREATE INDEX "FollowUpScheduled_userId_dealId_idx" ON "FollowUpScheduled"("userId", "dealId");

-- CreateIndex
CREATE INDEX "FollowUpScheduled_nextStepAt_status_idx" ON "FollowUpScheduled"("nextStepAt", "status");

-- CreateIndex
CREATE INDEX "FollowUpEvent_scheduledId_createdAt_idx" ON "FollowUpEvent"("scheduledId", "createdAt");

-- CreateIndex
CREATE INDEX "FollowUpEvent_eventType_idx" ON "FollowUpEvent"("eventType");

-- AddForeignKey
ALTER TABLE "OfferedDeal" ADD CONSTRAINT "OfferedDeal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferedDeal" ADD CONSTRAINT "OfferedDeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpSequence" ADD CONSTRAINT "FollowUpSequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpScheduled" ADD CONSTRAINT "FollowUpScheduled_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpScheduled" ADD CONSTRAINT "FollowUpScheduled_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpScheduled" ADD CONSTRAINT "FollowUpScheduled_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "FollowUpSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpEvent" ADD CONSTRAINT "FollowUpEvent_scheduledId_fkey" FOREIGN KEY ("scheduledId") REFERENCES "FollowUpScheduled"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpEvent" ADD CONSTRAINT "FollowUpEvent_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "FollowUpSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
