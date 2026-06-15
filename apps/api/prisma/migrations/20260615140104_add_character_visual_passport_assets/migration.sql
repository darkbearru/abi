-- CreateEnum
CREATE TYPE "AssetApprovalStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AssetEntityType" ADD VALUE 'CHARACTER_VERSION';

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "approvalStatus" "AssetApprovalStatus" NOT NULL DEFAULT 'DRAFT';
