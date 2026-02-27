-- CreateEnum
CREATE TYPE "SkipTraceStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'NOT_FOUND');

-- AlterTable: Add ownershipEmail and skipTraced columns to Property
ALTER TABLE "Property" ADD COLUMN "ownershipEmail" TEXT;
ALTER TABLE "Property" ADD COLUMN "skipTraced" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SkipTraceRequest" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SkipTraceStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "phoneFound" BOOLEAN NOT NULL DEFAULT false,
    "emailFound" BOOLEAN NOT NULL DEFAULT false,
    "rawResponse" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkipTraceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_skipTraced_idx" ON "Property"("skipTraced");

-- CreateIndex
CREATE INDEX "SkipTraceRequest_propertyId_idx" ON "SkipTraceRequest"("propertyId");

-- CreateIndex
CREATE INDEX "SkipTraceRequest_userId_status_idx" ON "SkipTraceRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "SkipTraceRequest_requestedAt_idx" ON "SkipTraceRequest"("requestedAt");

-- AddForeignKey
ALTER TABLE "SkipTraceRequest" ADD CONSTRAINT "SkipTraceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkipTraceRequest" ADD CONSTRAINT "SkipTraceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
