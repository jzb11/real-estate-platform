-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "daysOnMarket" INTEGER,
ADD COLUMN     "debtOwed" DOUBLE PRECISION,
ADD COLUMN     "equityPercent" DOUBLE PRECISION,
ADD COLUMN     "interestRate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "SavedSearchFilter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearchFilter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedSearchFilter_userId_idx" ON "SavedSearchFilter"("userId");

-- CreateIndex
CREATE INDEX "Property_equityPercent_idx" ON "Property"("equityPercent");

-- CreateIndex
CREATE INDEX "Property_debtOwed_idx" ON "Property"("debtOwed");

-- CreateIndex
CREATE INDEX "Property_daysOnMarket_idx" ON "Property"("daysOnMarket");

-- AddForeignKey
ALTER TABLE "SavedSearchFilter" ADD CONSTRAINT "SavedSearchFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
