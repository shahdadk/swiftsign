import { prisma } from "@/lib/db";
import { SigningForm } from "@/components/signing-form";
import { getActiveDisclosure } from "@/lib/consent";
import { isTokenExpired } from "@/lib/signing-token";

export const runtime = "nodejs";

export const metadata = {
  title: "Sign Document — SwiftSign",
  robots: { index: false, follow: false },
};

interface EmbedPageProps {
  params: Promise<{ token: string }>;
}

export default async function EmbedPage({ params }: EmbedPageProps) {
  const { token } = await params;

  const session = await prisma.embeddedSession.findUnique({
    where: { token },
    include: {
      recipient: {
        include: {
          envelope: {
            include: {
              user: { select: { name: true, email: true, company: true } },
              documents: { orderBy: { order: "asc" } },
            },
          },
          fields: true,
        },
      },
    },
  });

  // Invalid / expired / already-consumed entry tickets all render the same
  // friendly message — never leak which case it was.
  const invalid =
    !session ||
    session.usedAt !== null ||
    isTokenExpired(session.expiresAt);

  if (invalid) {
    return <ExpiredMessage />;
  }

  // Consume the single-use ticket. (The recipient still signs with their own
  // signingToken on POST /api/sign/[token]; this only gates entry.)
  await prisma.embeddedSession.update({
    where: { id: session!.id },
    data: { usedAt: new Date() },
  });

  const recipient = session!.recipient;
  const envelope = recipient.envelope;

  // Terminal envelope / recipient states still render the friendly card rather
  // than a half-broken signing UI.
  if (
    envelope.status === "VOIDED" ||
    envelope.status === "DECLINED" ||
    envelope.status === "COMPLETED" ||
    recipient.status === "SIGNED" ||
    recipient.status === "DECLINED"
  ) {
    return (
      <ExpiredMessage message="This document is no longer available for signing." />
    );
  }

  const needsConsent = recipient.consentedAt === null;
  const disclosure = needsConsent ? await getActiveDisclosure() : null;

  const documents = needsConsent
    ? []
    : envelope.documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        pageCount: doc.pageCount,
        order: doc.order,
      }));

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
        options: Array.isArray(field.options)
          ? (field.options as string[])
          : null,
      }));

  const savedAdoption = await prisma.signatureAdoption.findUnique({
    where: { email_name: { email: recipient.email, name: recipient.name } },
  });

  return (
    <SigningForm
      token={recipient.signingToken}
      embedded
      returnUrl={session!.returnUrl ?? undefined}
      envelope={{
        id: envelope.id,
        subject: envelope.subject,
        message: envelope.message,
        senderName: envelope.user.name ?? "Unknown",
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
  );
}

function ExpiredMessage({
  message = "This signing link has expired or has already been used. Please request a new link from the sender.",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col flex-1 min-h-screen items-center justify-center px-6 bg-white">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold mb-3">Link Expired</h1>
        <p className="text-gray-600 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
