-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "tosAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "tosAcceptedVersion" TEXT;

