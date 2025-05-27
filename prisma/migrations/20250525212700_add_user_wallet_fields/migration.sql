-- AlterTable
ALTER TABLE "User" ADD COLUMN     "assets" TEXT,
ADD COLUMN     "balance" TEXT,
ADD COLUMN     "lastUpdated" TIMESTAMP(3),
ADD COLUMN     "provider" TEXT;
