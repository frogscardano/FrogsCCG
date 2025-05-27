/*
  Warnings:

  - You are about to drop the column `attributes` on the `NFT` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `NFT` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `NFT` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `NFT` table. All the data in the column will be lost.
  - You are about to drop the column `packId` on the `NFT` table. All the data in the column will be lost.
  - You are about to drop the column `packOpeningId` on the `NFT` table. All the data in the column will be lost.
  - You are about to drop the column `rarity` on the `NFT` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `walletAddress` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ActivityLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Card` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Pack` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PackOpening` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProcessedTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserCard` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Wallet` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[tokenId,contractAddress]` on the table `NFT` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[address]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `contractAddress` to the `NFT` table without a default value. This is not possible if the table is not empty.
  - Made the column `ownerId` on table `NFT` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `address` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "NFT" DROP CONSTRAINT "NFT_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "NFT" DROP CONSTRAINT "NFT_packId_fkey";

-- DropForeignKey
ALTER TABLE "NFT" DROP CONSTRAINT "NFT_packOpeningId_fkey";

-- DropForeignKey
ALTER TABLE "PackOpening" DROP CONSTRAINT "PackOpening_packId_fkey";

-- DropForeignKey
ALTER TABLE "PackOpening" DROP CONSTRAINT "PackOpening_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "PackOpening" DROP CONSTRAINT "PackOpening_userId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_packId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserCard" DROP CONSTRAINT "UserCard_cardId_fkey";

-- DropIndex
DROP INDEX "NFT_tokenId_key";

-- DropIndex
DROP INDEX "User_walletAddress_key";

-- AlterTable
ALTER TABLE "NFT" DROP COLUMN "attributes",
DROP COLUMN "description",
DROP COLUMN "image",
DROP COLUMN "name",
DROP COLUMN "packId",
DROP COLUMN "packOpeningId",
DROP COLUMN "rarity",
ADD COLUMN     "contractAddress" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB,
ALTER COLUMN "ownerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
DROP COLUMN "password",
DROP COLUMN "walletAddress",
ADD COLUMN     "address" TEXT NOT NULL;

-- DropTable
DROP TABLE "ActivityLog";

-- DropTable
DROP TABLE "Card";

-- DropTable
DROP TABLE "Pack";

-- DropTable
DROP TABLE "PackOpening";

-- DropTable
DROP TABLE "Payment";

-- DropTable
DROP TABLE "ProcessedTransaction";

-- DropTable
DROP TABLE "UserCard";

-- DropTable
DROP TABLE "Wallet";

-- CreateIndex
CREATE UNIQUE INDEX "NFT_tokenId_contractAddress_key" ON "NFT"("tokenId", "contractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- AddForeignKey
ALTER TABLE "NFT" ADD CONSTRAINT "NFT_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
