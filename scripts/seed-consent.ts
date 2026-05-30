import 'dotenv/config'
import { prisma } from '../src/lib/db'

// Seeds / updates the active ESIGN consumer disclosure. Run against any DB:
// `npx tsx scripts/seed-consent.ts`. Bump VERSION when the text changes.
const VERSION = '2026-05-30.1'

const BODY = `ELECTRONIC RECORD AND SIGNATURE DISCLOSURE

By selecting "I agree" you consent to receive and sign this document and related
records electronically, under the U.S. ESIGN Act and applicable state UETA (and,
for Canadian parties, PIPEDA / provincial electronic-commerce law).

1. Consent to electronic records. You agree that your electronic signature on
   the documents presented is the legal equivalent of your handwritten
   signature, and that you intend to be bound by it.

2. Right to a paper copy. You may request a paper copy of any record at no
   charge by emailing support@swiftsign.ca with the document reference.

3. Withdrawing consent. You may decline to sign electronically and withdraw
   consent at any time before completing your signature by selecting "Decline"
   or by closing this window; doing so means the document will not be completed
   electronically through SwiftSign.

4. Retention. A completed copy, together with a Certificate of Completion, will
   be emailed to you. You are responsible for retaining your copy.

5. Identity. Your access to this document is via a unique, single-use link sent
   to your email address; completing the signature attributes the signature to
   the holder of that email.`

const HW_SW = `To access and retain these records you need: a current web browser
(Chrome, Safari, Edge, or Firefox, latest two versions); a valid email account;
a device able to display and download PDF files (most modern computers, tablets,
and phones); and sufficient storage to save a copy. If these requirements change
materially we will notify you and you may withdraw consent.`

async function main() {
  await prisma.consentDisclosure.upsert({
    where: { version: VERSION },
    update: { isActive: true, body: BODY, hardwareSoftwareReqs: HW_SW },
    create: {
      version: VERSION,
      body: BODY,
      hardwareSoftwareReqs: HW_SW,
      isActive: true,
    },
  })
  await prisma.consentDisclosure.updateMany({
    where: { version: { not: VERSION } },
    data: { isActive: false },
  })
  console.log('Seeded consent disclosure', VERSION)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
