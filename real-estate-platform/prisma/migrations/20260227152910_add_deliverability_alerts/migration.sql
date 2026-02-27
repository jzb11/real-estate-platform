-- CreateTable
CREATE TABLE "DeliverabilityAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliverabilityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliverabilityAlert_userId_alertType_createdAt_idx" ON "DeliverabilityAlert"("userId", "alertType", "createdAt");

-- CreateIndex
CREATE INDEX "DeliverabilityAlert_userId_acknowledged_idx" ON "DeliverabilityAlert"("userId", "acknowledged");

-- AddForeignKey
ALTER TABLE "DeliverabilityAlert" ADD CONSTRAINT "DeliverabilityAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
