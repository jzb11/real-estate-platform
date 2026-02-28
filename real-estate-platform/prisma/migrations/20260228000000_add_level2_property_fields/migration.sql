-- Level 2 Advanced Deal Analysis: add physical property attributes
-- These fields support comp validation, rehab trap detection, and multifamily liquidity checks

ALTER TABLE "Property" ADD COLUMN "yearBuilt" INTEGER;
ALTER TABLE "Property" ADD COLUMN "squareFootage" DOUBLE PRECISION;
ALTER TABLE "Property" ADD COLUMN "bedrooms" INTEGER;
ALTER TABLE "Property" ADD COLUMN "bathrooms" DOUBLE PRECISION;
ALTER TABLE "Property" ADD COLUMN "unitCount" INTEGER;
ALTER TABLE "Property" ADD COLUMN "lotSize" DOUBLE PRECISION;
ALTER TABLE "Property" ADD COLUMN "annualPropertyTax" DOUBLE PRECISION;

-- Index on unitCount for multifamily liquidity queries
CREATE INDEX "Property_unitCount_idx" ON "Property"("unitCount");
