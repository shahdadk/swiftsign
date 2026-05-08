"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { PdfViewer } from "./pdf-viewer";
import { SignatureModal } from "./signature-modal";
import { Logo } from "./landing/icons";

type FieldType = "SIGNATURE" | "NAME" | "DATE" | "TEXT" | "INITIALS" | "CHECKBOX";

interface FieldData {
  id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | null;
  required: boolean;
  documentId: string;
}

interface SigningFormProps {
  token: string;
  envelope: {
    id: string;
    subject: string;
    message: string | null;
    senderName: string;
    senderEmail: string;
    senderCompany: string | null;
  };
  recipient: {
    id: string;
    name: string;
    email: string;
  };
  documents: {
    id: string;
    name: string;
    pageCount: number;
    order: number;
  }[];
  fields: FieldData[];
  savedSignature?: string;
  savedInitials?: string;
}

type Step = "CONSENT" | "SIGNING" | "SUBMITTING" | "COMPLETE";

export function SigningForm({
  token,
  envelope,
  recipient,
  documents,
  fields: initialFields,
  savedSignature,
  savedInitials,
}: SigningFormProps) {
  const [step, setStep] = useState<Step>("CONSENT");

  // Pre-fill signature/initials fields if we have saved adoptions
  const prefilledFields = initialFields.map((f) => {
    if (f.type === "SIGNATURE" && savedSignature && !f.value) {
      return { ...f, value: savedSignature };
    }
    if (f.type === "INITIALS" && savedInitials && !f.value) {
      return { ...f, value: savedInitials };
    }
    return f;
  });

  const [fields, setFields] = useState<FieldData[]>(prefilledFields);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeField = activeFieldId
    ? fields.find((f) => f.id === activeFieldId)
    : null;

  const completedCount = fields.filter((f) => f.value).length;
  const requiredCount = fields.filter((f) => f.required).length;
  const requiredCompleted = fields.filter(
    (f) => f.required && f.value
  ).length;
  const allRequiredDone = requiredCompleted === requiredCount;

  const updateFieldValue = useCallback(
    (fieldId: string, value: string) => {
      setFields((prev) =>
        prev.map((f) => (f.id === fieldId ? { ...f, value } : f))
      );
    },
    []
  );

  const handleConsent = () => {
    // Auto-fill NAME and DATE fields
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    setFields((prev) =>
      prev.map((f) => {
        if (f.type === "DATE" && !f.value) return { ...f, value: today };
        if (f.type === "NAME" && !f.value) return { ...f, value: recipient.name };
        return f;
      })
    );
    setStep("SIGNING");
  };

  const handleDecline = async () => {
    try {
      const res = await fetch(`/api/sign/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to decline");
      }
      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to decline signing"
      );
    }
  };

  const handleFieldClick = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    setActiveFieldId(fieldId);

    switch (field.type) {
      case "SIGNATURE":
      case "INITIALS":
        setShowSignatureModal(true);
        break;
      case "NAME":
        updateFieldValue(fieldId, recipient.name);
        setActiveFieldId(null);
        break;
      case "DATE":
        updateFieldValue(
          fieldId,
          new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        );
        setActiveFieldId(null);
        break;
      case "CHECKBOX":
        updateFieldValue(fieldId, field.value ? "" : "true");
        setActiveFieldId(null);
        break;
      case "TEXT":
        // Text fields are handled inline
        break;
    }
  };

  const handleSignatureAdopt = (dataUrl: string) => {
    if (activeFieldId) {
      updateFieldValue(activeFieldId, dataUrl);
    }
    setShowSignatureModal(false);
    setActiveFieldId(null);
  };

  const handleComplete = async () => {
    setShowConfirmDialog(false);
    setStep("SUBMITTING");
    setError(null);

    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: fields.map((f) => ({
            fieldId: f.id,
            value: f.value || "",
          })),
          consent: { accepted: true, version: "1.0" },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete signing");
      }

      setStep("COMPLETE");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setStep("SIGNING");
    }
  };

  // Render consent step
  if (step === "CONSENT") {
    return (
      <div className="flex flex-col flex-1">
        <Header envelope={envelope} />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-2xl">
            {/* Sender info */}
            <div className="mb-8 text-center">
              <p className="text-gray-500 text-sm mb-1">
                {envelope.senderName}
                {envelope.senderCompany && ` (${envelope.senderCompany})`} sent
                you a document to sign
              </p>
              <h2 className="text-xl font-semibold">{envelope.subject}</h2>
              {envelope.message && (
                <p className="text-gray-600 mt-2 text-sm">
                  {envelope.message}
                </p>
              )}
            </div>

            {/* Consent card */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Electronic Signature Consent
                  </h3>
                  <p className="text-gray-600 text-sm mt-1 leading-relaxed">
                    By clicking &ldquo;I Agree,&rdquo; you consent to sign this
                    document electronically. You may withdraw consent before
                    signing, request a paper copy by contacting the sender, or
                    decline to sign.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={handleConsent}
                  className="flex-1 h-11 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
                >
                  I Agree
                </button>
                <button
                  onClick={() => setShowDeclineDialog(true)}
                  className="h-11 px-6 text-gray-500 hover:text-gray-700 font-medium transition-colors"
                >
                  Decline to Sign
                </button>
              </div>
            </div>

            {/* Documents list */}
            <div className="mt-6 px-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">
                Documents
              </p>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 text-sm text-gray-600 py-1.5"
                >
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                  </svg>
                  {doc.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Decline dialog */}
        {showDeclineDialog && (
          <Dialog
            title="Decline to Sign"
            onClose={() => setShowDeclineDialog(false)}
          >
            <p className="text-gray-600 text-sm mb-4">
              Are you sure you want to decline? The sender will be notified that
              you chose not to sign.
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason for declining (optional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeclineDialog(false)}
                className="h-9 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                className="h-9 px-4 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Decline to Sign
              </button>
            </div>
          </Dialog>
        )}

        {error && <ErrorToast message={error} onDismiss={() => setError(null)} />}
      </div>
    );
  }

  // Render signing step
  if (step === "SIGNING" || step === "SUBMITTING") {
    const currentDoc = documents[0]; // MVP: show first document
    const docFields = fields.filter(
      (f) => f.documentId === currentDoc?.id
    );

    return (
      <div className="flex flex-col h-screen">
        <Header envelope={envelope} />

        {/* Progress bar */}
        <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {completedCount} of {fields.length} fields completed
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {fields.map((f) => (
              <div
                key={f.id}
                className={`w-2 h-2 rounded-full transition-colors ${
                  f.value ? "bg-green-500" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto bg-gray-100">
          <div className="p-4">
            <PdfViewer
              documentId={currentDoc.id}
              token={token}
              pageCount={currentDoc.pageCount || 1}
              fields={docFields}
              onFieldClick={handleFieldClick}
              activeFieldId={activeFieldId}
              onTextFieldChange={updateFieldValue}
            />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400 hidden sm:block">
            Signed with SwiftSign
          </p>
          <button
            onClick={() => setShowConfirmDialog(true)}
            disabled={!allRequiredDone || step === "SUBMITTING"}
            className="h-11 px-6 sm:px-8 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ml-auto"
          >
            {step === "SUBMITTING" ? (
              <>
                <Spinner size="sm" />
                Submitting...
              </>
            ) : (
              "Complete Signing"
            )}
          </button>
        </div>

        {/* Signature modal */}
        {showSignatureModal && activeField && (
          <SignatureModal
            fieldType={activeField.type === "INITIALS" ? "initials" : "signature"}
            onAdopt={handleSignatureAdopt}
            onCancel={() => {
              setShowSignatureModal(false);
              setActiveFieldId(null);
            }}
          />
        )}

        {/* Confirm dialog */}
        {showConfirmDialog && (
          <Dialog
            title="Complete Signing"
            onClose={() => setShowConfirmDialog(false)}
          >
            <p className="text-gray-600 text-sm mb-6">
              Once signed, this cannot be undone. Please confirm you want to
              complete signing this document.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="h-9 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                className="h-9 px-5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                Sign and Complete
              </button>
            </div>
          </Dialog>
        )}

        {error && <ErrorToast message={error} onDismiss={() => setError(null)} />}
      </div>
    );
  }

  // Complete step
  return (
    <div className="flex flex-col flex-1">
      <Header envelope={envelope} />
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 12.75 6 6 9-13.5"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold mb-3">
            Signing Complete
          </h2>
          <p className="text-gray-600 leading-relaxed">
            You&apos;ve signed &ldquo;{envelope.subject}&rdquo;. You&apos;ll
            receive a copy by email when all parties have signed.
          </p>
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
    </div>
  );
}

// --- Shared UI components ---

function Header({
  envelope,
}: {
  envelope: { subject: string; senderName: string };
}) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-900">
        <Logo size={22} />
        <span className="font-semibold text-sm">SwiftSign</span>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium truncate max-w-[200px] sm:max-w-none">
          {envelope.subject}
        </p>
        <p className="text-xs text-gray-400">from {envelope.senderName}</p>
      </div>
    </header>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Spinner({ size = "md" }: { size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-4 h-4" : "w-6 h-6";
  return (
    <svg
      className={`${cls} animate-spin text-current`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50">
      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3 shadow-lg">
        <svg
          className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
        <p className="text-sm text-red-700 flex-1">{message}</p>
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
