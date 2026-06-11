"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import { Logo } from "./landing/icons";
import {
  loadImageElement,
  processSignatureSource,
} from "@/lib/signature-image";

// react-pdf and the canvas signature pad touch browser globals (DOMMatrix,
// canvas) during render, which throws when this client component is
// server-rendered on the /sign/[token] page. Load them client-only so the
// signer page SSRs instead of 500ing.
const PdfViewer = dynamic(() => import("./pdf-viewer").then((m) => m.PdfViewer), {
  ssr: false,
});
const SignatureModal = dynamic(
  () => import("./signature-modal").then((m) => m.SignatureModal),
  { ssr: false }
);

type FieldType =
  | "SIGNATURE"
  | "NAME"
  | "DATE"
  | "TEXT"
  | "INITIALS"
  | "CHECKBOX"
  | "RADIO"
  | "DROPDOWN"
  | "ATTACHMENT";

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
  options?: string[] | null;
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
  documentNames: string[];
  fields: FieldData[];
  needsConsent: boolean;
  disclosure: {
    version: string;
    body: string;
    hardwareSoftwareReqs: string;
  } | null;
  savedSignature?: string;
  savedInitials?: string;
  // Embedded (iframe) signing. When true, the completion step posts a
  // `swiftsign:completed` message to the parent frame and (if a returnUrl was
  // provided) redirects there.
  embedded?: boolean;
  returnUrl?: string;
}

type Step = "CONSENT" | "SIGNING" | "SUBMITTING" | "COMPLETE";

export function SigningForm({
  token,
  envelope,
  recipient,
  documents,
  documentNames,
  fields: initialFields,
  needsConsent,
  disclosure,
  savedSignature,
  savedInitials,
  embedded = false,
  returnUrl,
}: SigningFormProps) {
  const [step, setStep] = useState<Step>(needsConsent ? "CONSENT" : "SIGNING");
  const [consenting, setConsenting] = useState(false);
  // Version of the disclosure actually shown to this signer; echoed in the
  // final sign POST. Falls back to the legacy "1.0" when already consented and
  // no live disclosure was passed.
  const consentVersion = disclosure?.version ?? "1.0";

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
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Auto-fill NAME and DATE fields once the signer is on the signing step
  // (the page renders directly here after consent reloads). Previously this ran
  // inside the client-only handleConsent before the consent POST existed.
  useEffect(() => {
    if (step !== "SIGNING") return;
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    setFields((prev) => {
      let changed = false;
      const next = prev.map((f) => {
        if (f.type === "DATE" && !f.value) {
          changed = true;
          return { ...f, value: today };
        }
        if (f.type === "NAME" && !f.value) {
          changed = true;
          return { ...f, value: recipient.name };
        }
        return f;
      });
      return changed ? next : prev;
    });
  }, [step, recipient.name]);

  const activeField = activeFieldId
    ? fields.find((f) => f.id === activeFieldId)
    : null;

  const completedCount = fields.filter((f) => f.value).length;
  const requiredCount = fields.filter((f) => f.required).length;
  const requiredCompleted = fields.filter(
    (f) => f.required && f.value
  ).length;
  const allRequiredDone = requiredCompleted === requiredCount;

  // Reading-order sort (document, page, top-to-bottom, left-to-right) so the
  // guided "Next" flow walks the document the way a person reads it.
  const docOrder = new Map(documents.map((d) => [d.id, d.order]));
  const nextRequiredField =
    [...fields]
      .sort(
        (a, b) =>
          (docOrder.get(a.documentId) ?? 0) - (docOrder.get(b.documentId) ?? 0) ||
          a.page - b.page ||
          a.y - b.y ||
          a.x - b.x
      )
      .find((f) => f.required && !f.value) ?? null;

  const goToNextField = useCallback(() => {
    if (!nextRequiredField) return;
    document
      .getElementById(`sigfield-${nextRequiredField.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [nextRequiredField]);

  const updateFieldValue = useCallback(
    (fieldId: string, value: string) => {
      setFields((prev) =>
        prev.map((f) => (f.id === fieldId ? { ...f, value } : f))
      );
    },
    []
  );

  // Legacy saved adoptions (and any API-submitted signature) may be opaque
  // PNGs with a white background that covers the signature line and nearby
  // text when stamped on the PDF. Normalize them on load: strip the
  // background, crop to the ink. The cleaned value is what gets submitted,
  // which also upgrades the signer's saved adoption for future documents.
  useEffect(() => {
    let cancelled = false;
    const normalize = async () => {
      const candidates = fields.filter(
        (f) =>
          (f.type === "SIGNATURE" || f.type === "INITIALS") &&
          f.value?.startsWith("data:image/")
      );
      for (const f of candidates) {
        try {
          const img = await loadImageElement(f.value!);
          const processed = processSignatureSource(img, {
            removeBackground: true,
            padding: 12,
          });
          if (!cancelled && processed) updateFieldValue(f.id, processed.dataUrl);
        } catch {
          // Keep the original value — the server normalizes again at seal time.
        }
      }
    };
    void normalize();
    return () => {
      cancelled = true;
    };
    // Mount-only: normalizes the server-provided prefills exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConsent = async () => {
    setConsenting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/${token}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to record consent");
      }
      // Consent recorded server-side. Reload so the server re-renders the page
      // with full document data + fields (withheld until consent existed) and
      // the signing step.
      window.location.reload();
    } catch (err) {
      setConsenting(false);
      setError(
        err instanceof Error ? err.message : "Failed to record consent"
      );
    }
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
      case "RADIO":
      case "DROPDOWN":
      case "ATTACHMENT":
        // These are filled inline within the PDF overlay (text input, radio
        // group, select, or file picker) — no modal or auto-fill needed.
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
          consent: { accepted: true, version: consentVersion },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete signing");
      }

      setStep("COMPLETE");

      // Embedded signing: notify the host page and optionally bounce back.
      if (embedded) {
        try {
          window.parent.postMessage(
            { type: "swiftsign:completed", envelopeId: envelope.id },
            "*"
          );
        } catch {
          // postMessage can throw in exotic sandboxes — never block completion.
        }
        if (returnUrl) {
          window.location.href = returnUrl;
        }
      }
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
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-12">
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
            <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-8 shadow-sm">
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

              {disclosure && (
                <button
                  type="button"
                  onClick={() => setShowDisclosure(true)}
                  className="mt-3 text-sm font-medium text-primary hover:underline"
                >
                  View electronic record &amp; signature disclosure
                </button>
              )}

              <button
                onClick={handleConsent}
                disabled={consenting}
                className="mt-6 w-full h-14 rounded-xl bg-primary text-white text-base font-semibold hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
              >
                {consenting ? (
                  <>
                    <Spinner size="sm" />
                    Recording...
                  </>
                ) : (
                  "I Agree"
                )}
              </button>
              <button
                onClick={() => setShowDeclineDialog(true)}
                disabled={consenting}
                className="mt-3 w-full h-11 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Decline to sign
              </button>
            </div>

            {/* Documents list */}
            <div className="mt-6 px-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">
                Documents
              </p>
              {documentNames.map((name, i) => (
                <div
                  key={i}
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
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Electronic record disclosure modal */}
        {showDisclosure && disclosure && (
          <Dialog
            title="Electronic Record & Signature Disclosure"
            onClose={() => setShowDisclosure(false)}
          >
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {disclosure.body}
            </div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mt-4 mb-1">
              Hardware &amp; Software Requirements
            </p>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {disclosure.hardwareSoftwareReqs}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Disclosure version {disclosure.version}
            </p>
            <div className="flex justify-end mt-5">
              <button
                onClick={() => setShowDisclosure(false)}
                className="h-11 px-5 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </Dialog>
        )}

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
                className="h-11 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                className="h-11 px-4 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
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
    const requiredRemaining = requiredCount - requiredCompleted;

    return (
      <div className="flex flex-col h-screen">
        <Header envelope={envelope} />

        {/* Progress strip */}
        <div className="bg-white border-b border-gray-100 px-4 pt-2 pb-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs sm:text-sm text-gray-500">
              {completedCount} of {fields.length} fields completed
              {documents.length > 1 && (
                <span className="text-gray-400">
                  {" "}
                  · {documents.length} documents
                </span>
              )}
            </span>
            <button
              onClick={() => setShowDeclineDialog(true)}
              className="text-xs text-gray-400 hover:text-red-600 font-medium transition-colors"
            >
              Decline to sign
            </button>
          </div>
          <div
            className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={fields.length}
            aria-valuenow={completedCount}
          >
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{
                width: `${fields.length ? (completedCount / fields.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* All documents stacked vertically */}
        <div className="flex-1 overflow-auto bg-gray-100">
          <div className="p-2 sm:p-4 max-w-4xl mx-auto space-y-8">
            {documents.map((doc, i) => {
              const docFields = fields.filter((f) => f.documentId === doc.id);
              return (
                <section key={doc.id}>
                  <header className="flex items-baseline justify-between mb-2 px-1">
                    <h2 className="text-sm font-semibold text-gray-900 truncate">
                      {documents.length > 1 && (
                        <span className="text-xs text-gray-400 font-medium mr-2">
                          {i + 1} / {documents.length}
                        </span>
                      )}
                      {doc.name}
                    </h2>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {docFields.filter((f) => f.value).length}/{docFields.length}{" "}
                      fields
                    </span>
                  </header>
                  <PdfViewer
                    documentId={doc.id}
                    token={token}
                    pageCount={doc.pageCount || 1}
                    fields={docFields}
                    onFieldClick={handleFieldClick}
                    activeFieldId={activeFieldId}
                    nextFieldId={nextRequiredField?.id ?? null}
                    onTextFieldChange={updateFieldValue}
                  />
                </section>
              );
            })}
            <p className="text-center text-xs text-gray-400 pt-2 pb-8">
              Scroll up to review · all documents bundled into one signing
              session
            </p>
          </div>
        </div>

        {/* Guided "next field" pill — takes the signer to the next thing to
            do instead of making them hunt through pages. */}
        {!allRequiredDone && step === "SIGNING" && (
          <button
            onClick={goToNextField}
            className="fixed right-4 sm:right-8 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 h-11 pl-5 pr-4 rounded-full bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/30 flex items-center gap-2 hover:bg-primary-dark active:scale-[0.98] transition-all"
          >
            {requiredCompleted === 0 ? "Start" : "Next"}
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"
              />
            </svg>
          </button>
        )}

        {/* Bottom bar */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 pb-safe flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {requiredRemaining > 0 ? (
              <>
                <span className="sm:hidden">{requiredRemaining} required left</span>
                <span className="hidden sm:inline">{`${requiredRemaining} required field${requiredRemaining === 1 ? "" : "s"} remaining`}</span>
              </>
            ) : (
              "All required fields complete"
            )}
          </p>
          {/* When disabled, a tap walks the signer to the missing field
              instead of doing nothing. */}
          <span
            onClick={!allRequiredDone ? goToNextField : undefined}
            className="ml-auto"
          >
            <button
              onClick={() => setShowConfirmDialog(true)}
              disabled={!allRequiredDone || step === "SUBMITTING"}
              className="h-11 px-6 sm:px-8 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
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
          </span>
        </div>

        {/* Signature modal */}
        {showSignatureModal && activeField && (
          <SignatureModal
            fieldType={activeField.type === "INITIALS" ? "initials" : "signature"}
            signerName={recipient.name}
            onAdopt={handleSignatureAdopt}
            onCancel={() => {
              setShowSignatureModal(false);
              setActiveFieldId(null);
            }}
          />
        )}

        {/* Decline dialog (also reachable during signing) */}
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
                className="h-11 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                className="h-11 px-5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
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
        <p className="text-sm font-medium truncate max-w-[55vw] sm:max-w-none">
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
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
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
