// One-off: seed the ESIGN/UETA consent disclosure that the signing flow
// requires before any signer can hit "I agree". Without it, recordConsent
// throws "No active consent disclosure configured" -> 500.
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const VERSION = '2026-06-02-v1'

const BODY = `
Consumer Disclosure for Electronic Signatures and Records

You agree to use electronic records and signatures for any agreement you sign
through SwiftSign. By accepting this disclosure, you consent to receive
documents and notices in electronic form and to sign them electronically.

You can withdraw consent at any time by contacting the sender of the document
before completing your signature. Withdrawing consent may prevent you from
completing the signing process.

To access and retain documents, you need a current web browser, internet
connection, an email address, and the ability to view and save PDF files.
You can request a paper copy of any signed document by contacting the sender.

Your electronic signature has the same legal effect as a handwritten signature
under the ESIGN Act (US) and the Electronic Commerce Acts in Canada (UETA-
equivalent provincial statutes).
`.trim()

const HARDWARE_SOFTWARE_REQS = `
- A current version of Chrome, Safari, Firefox, or Edge
- A reliable internet connection
- A working email address that can receive HTML email
- The ability to download and view PDF files (Acrobat Reader, Preview, or any
  modern browser)
- A device with sufficient storage to save documents locally if desired
`.trim()

async function main() {
  const existing = await prisma.consentDisclosure.findFirst({
    where: { isActive: true },
  })
  if (existing) {
    console.log('active disclosure already present:', existing.version)
    return
  }

  // Deactivate any older inactive ones with the same version (defensive)
  await prisma.consentDisclosure.deleteMany({ where: { version: VERSION } })

  const created = await prisma.consentDisclosure.create({
    data: {
      version: VERSION,
      body: BODY,
      hardwareSoftwareReqs: HARDWARE_SOFTWARE_REQS,
      isActive: true,
    },
  })
  console.log('seeded ConsentDisclosure:', { id: created.id, version: created.version })
}

main()
  .catch((err) => {
    console.error('seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
