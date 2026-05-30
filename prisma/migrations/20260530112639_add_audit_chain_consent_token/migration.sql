-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "prevHash" TEXT,
ADD COLUMN     "rowHash" TEXT,
ADD COLUMN     "seq" INTEGER;

-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN     "consentedAt" TIMESTAMP(3),
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "tokenUsedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ConsentDisclosure" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "body" TEXT NOT NULL,
    "hardwareSoftwareReqs" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConsentDisclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "disclosureId" TEXT NOT NULL,
    "disclosureVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsentDisclosure_version_key" ON "ConsentDisclosure"("version");

-- CreateIndex
CREATE INDEX "ConsentRecord_recipientId_idx" ON "ConsentRecord"("recipientId");

-- CreateIndex
CREATE INDEX "AuditLog_envelopeId_seq_idx" ON "AuditLog"("envelopeId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_envelopeId_seq_key" ON "AuditLog"("envelopeId", "seq");

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_disclosureId_fkey" FOREIGN KEY ("disclosureId") REFERENCES "ConsentDisclosure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Append-only enforcement: the tamper-evident audit log cannot be updated or
-- deleted (defends the chain against a DB-level rewrite).
CREATE OR REPLACE FUNCTION audit_no_mutate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_no_update BEFORE UPDATE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION audit_no_mutate();
CREATE TRIGGER audit_no_delete BEFORE DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION audit_no_mutate();
