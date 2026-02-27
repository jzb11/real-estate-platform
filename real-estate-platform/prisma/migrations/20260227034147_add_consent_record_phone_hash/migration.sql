/*
  Warnings:

  - Added the required column `phoneHash` to the `ConsentRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ConsentRecord" ADD COLUMN     "phoneHash" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ConsentRecord_phoneHash_idx" ON "ConsentRecord"("phoneHash");
