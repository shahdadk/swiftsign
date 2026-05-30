import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SigningForm } from "@/components/signing-form";
import { emit } from "@/lib/webhooks";
import { getSession } from "@/lib/auth";
import { getActiveDisclosure } from "@/lib/consent";

interface SignPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export async function generateMetadata({ params }: SignPageProps) {
  const { token } = await params;
  const recipient = await prisma.recipient.findUnique({
    where: { signingToken: token },
    include: { envelope: true },
  });

  if (!recipient) {
    return { title: "Document Not Found - SwiftSign" };
  }

  return {
    title: `Sign: ${recipient.envelope.subject} - SwiftSign`,
  };
}

export default async function SignPage({ params, searchParams }: SignPageProps) {
  const { token } = await params;
  const { preview } = await searchParams;

  const recipient = await prisma.recipient.findUnique({
    where: { signingToken: token },
    include: {
      envelope: {
        include: {
          user: { select: { name: true, email: true, company: true } },
          documents: {
            orderBy: { order: "asc" },
          },
          recipients: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,
              routingOrder: true,
            },
            orderBy: { routingOrder: "asc" },
          },
        },
      },
      fields: {
        include: {
          document: {
            select: { id: true, order: true },
          },
        },
      },
    },
  });

  if (!recipient) {
    notFound();
  }

  const { envelope } = recipient;

  // Handle terminal states
  if (envelope.status === "VOIDED") {
    return (
      <StatusPage
        icon="voided"
        title="Document Cancelled"
        message="This document has been voided by the sender and is no longer available for signing."
      />
    );
  }

  if (envelope.status === "DECLINED") {
    return (
      <StatusPage
        icon="declined"
        title="Document Declined"
        message="This document has been declined and is no longer available for signing."
      />
    );
  }

  if (recipient.status === "SIGNED") {
    return (
      <StatusPage
        icon="signed"
        title="Already Signed"
        message="You have already signed this document. You will receive a copy by email when all parties have signed."
      />
    );
  }

  if (envelope.status === "COMPLETED") {
    return (
      <StatusPage
        icon="completed"
        title="Document Completed"
        message="This document has been signed by all parties. A completed copy has been sent to your email."
      />
    );
  }

  // Preview mode: the envelope sender can view ANY recipient's signing page
  // by passing ?preview=1, with their dashboard cookie session. Skips the
  // viewedAt update, DOCUMENT_VIEWED audit log, and envelope.viewed webhook
  // so the recipient's audit trail stays clean.
  let isPreview = false;
  if (preview === "1") {
    const session = await getSession();
    if (session && session.id === envelope.userId) {
      isPreview = true;
    }
  }

  if (!isPreview) {
    // Log document viewed (track first-view for the envelope.viewed webhook)
    const isFirstView = recipient.viewedAt === null;
    await prisma.$transaction([
      prisma.recipient.update({
        where: { id: recipient.id },
        data: { viewedAt: recipient.viewedAt ?? new Date() },
      }),
      prisma.auditLog.create({
        data: {
          envelopeId: envelope.id,
          event: "DOCUMENT_VIEWED",
          actorName: recipient.name,
          actorEmail: recipient.email,
        },
      }),
    ]);

    if (isFirstView) {
      emit(envelope.userId, "envelope.viewed", {
        envelopeId: envelope.id,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
      });
    }
  }

  // Check for saved signature adoption
  const savedAdoption = await prisma.signatureAdoption.findUnique({
    where: { email_name: { email: recipient.email, name: recipient.name } },
  });

  // ESIGN gate: until the signer has accepted the disclosure, withhold all
  // document data and page-image keys from the server payload so the doc can't
  // be pulled pre-consent. Surface the active disclosure for the consent step.
  const needsConsent = recipient.consentedAt === null;

  const disclosure = needsConsent ? await getActiveDisclosure() : null;

  // Prepare data for client component — empty until consent exists.
  const documents = needsConsent
    ? []
    : envelope.documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        pageCount: doc.pageCount,
        order: doc.order,
      }));

  // This signer's interactive fields — withheld until consent exists.
  const fields = needsConsent
    ? []
    : recipient.fields.map((field) => ({
        id: field.id,
        type: field.type,
        page: field.page,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        value: field.value,
        required: field.required,
        documentId: field.documentId,
      }));

  return (
    <>
      {isPreview && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800 font-medium">
          🔍 Preview mode — you&apos;re seeing this page as <b>{recipient.name}</b>.
          Nothing you do here is saved. Don&apos;t click &ldquo;Complete Signing.&rdquo;
        </div>
      )}
      <SigningForm
        token={token}
        envelope={{
          id: envelope.id,
          subject: envelope.subject,
          message: envelope.message,
          senderName: envelope.user.name ?? 'Unknown',
          senderEmail: envelope.user.email,
          senderCompany: envelope.user.company,
        }}
        recipient={{
          id: recipient.id,
          name: recipient.name,
          email: recipient.email,
        }}
        documents={documents}
        documentNames={envelope.documents.map((doc) => doc.name)}
        fields={fields}
        needsConsent={needsConsent}
        disclosure={
          disclosure
            ? {
                version: disclosure.version,
                body: disclosure.body,
                hardwareSoftwareReqs: disclosure.hardwareSoftwareReqs,
              }
            : null
        }
        savedSignature={savedAdoption?.signature ?? undefined}
        savedInitials={savedAdoption?.initials ?? undefined}
      />
    </>
  );
}

function StatusPage({
  icon,
  title,
  message,
}: {
  icon: "voided" | "declined" | "signed" | "completed";
  title: string;
  message: string;
}) {
  const iconMap = {
    voided: (
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </div>
    ),
    declined: (
      <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </div>
    ),
    signed: (
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
    ),
    completed: (
      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
    ),
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center">
        {iconMap[icon]}
        <h1 className="text-2xl font-semibold mb-3">{title}</h1>
        <p className="text-gray-600 leading-relaxed">{message}</p>
        <div className="mt-8">
          <Link
            href="/"
            className="text-primary hover:text-primary-dark font-medium transition-colors"
          >
            Go to SwiftSign
          </Link>
        </div>
      </div>
    </div>
  );
}
