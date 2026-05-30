-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FieldType" ADD VALUE 'RADIO';
ALTER TYPE "FieldType" ADD VALUE 'DROPDOWN';
ALTER TYPE "FieldType" ADD VALUE 'ATTACHMENT';

-- AlterTable
ALTER TABLE "Envelope" ADD COLUMN     "livemode" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Field" ADD COLUMN     "options" JSONB;

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateDocument" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalKey" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "imageKeys" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TemplateDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateRole" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "routingOrder" INTEGER NOT NULL DEFAULT 1,
    "recipientType" "RecipientRole" NOT NULL DEFAULT 'SIGNER',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TemplateRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateField" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateDocumentId" TEXT NOT NULL,
    "templateRoleId" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "anchor" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB,

    CONSTRAINT "TemplateField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbeddedSession" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "returnUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddedSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_userId_createdAt_idx" ON "Template"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddedSession_token_key" ON "EmbeddedSession"("token");

-- CreateIndex
CREATE INDEX "EmbeddedSession_recipientId_idx" ON "EmbeddedSession"("recipientId");

-- CreateIndex
CREATE INDEX "Envelope_userId_createdAt_idx" ON "Envelope"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Envelope_userId_livemode_createdAt_idx" ON "Envelope"("userId", "livemode", "createdAt");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateDocument" ADD CONSTRAINT "TemplateDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateRole" ADD CONSTRAINT "TemplateRole_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateField" ADD CONSTRAINT "TemplateField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateField" ADD CONSTRAINT "TemplateField_templateDocumentId_fkey" FOREIGN KEY ("templateDocumentId") REFERENCES "TemplateDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateField" ADD CONSTRAINT "TemplateField_templateRoleId_fkey" FOREIGN KEY ("templateRoleId") REFERENCES "TemplateRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbeddedSession" ADD CONSTRAINT "EmbeddedSession_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

