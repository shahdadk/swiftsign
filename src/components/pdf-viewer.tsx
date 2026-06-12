"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Self-hosted pdfjs worker copied into public/ at build time.
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

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

interface FieldOverlay {
  id: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | null;
  required: boolean;
  options?: string[] | null;
}

interface PdfViewerProps {
  documentId: string;
  token: string;
  pageCount: number;
  fields: FieldOverlay[];
  onFieldClick: (fieldId: string) => void;
  activeFieldId: string | null;
  /** The next incomplete required field — gets a guiding pulse. */
  nextFieldId?: string | null;
  onTextFieldChange: (fieldId: string, value: string) => void;
}

const FIELD_LABELS: Record<FieldType, string> = {
  SIGNATURE: "Sign here",
  INITIALS: "Initials",
  NAME: "Full Name",
  DATE: "Date",
  TEXT: "Text",
  CHECKBOX: "Check",
  RADIO: "Choose one",
  DROPDOWN: "Select",
  ATTACHMENT: "Attach file",
};

export function PdfViewer({
  documentId,
  token,
  fields,
  onFieldClick,
  activeFieldId,
  nextFieldId,
  onTextFieldChange,
}: PdfViewerProps) {
  const fileUrl = useMemo(
    () => `/api/documents/${documentId}/file?token=${encodeURIComponent(token)}`,
    [documentId, token]
  );

  const [numPages, setNumPages] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [loadError, setLoadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (w > 0) setContainerWidth(Math.min(900, w));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <Document
        file={fileUrl}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        onLoadError={(err) => {
          setLoadError(err?.message ?? "Failed to load PDF");
        }}
        loading={
          <div className="w-full aspect-[8.5/11] bg-gray-200 rounded-lg animate-pulse" />
        }
        error={
          <div className="w-full aspect-[8.5/11] bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-sm text-gray-500">
              {loadError ?? "Failed to load document"}
            </p>
          </div>
        }
        className="w-full space-y-4"
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
          const pageFields = fields.filter((f) => f.page === pageNum);
          return (
            <div key={pageNum}>
              <div className="relative bg-white shadow-sm rounded-lg overflow-hidden">
                <Page
                  pageNumber={pageNum}
                  width={containerWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer={true}
                />
                {pageFields.map((field) => {
                  const isFilled = !!field.value;
                  const isActive = field.id === activeFieldId;
                  const isImageField =
                    field.type === "SIGNATURE" || field.type === "INITIALS";
                  const isInlineText = field.type === "TEXT";
                  const opts = field.options ?? [];
                  // Guide the signer: the next incomplete required field
                  // pulses until it's filled.
                  const isNext = field.id === nextFieldId && !isFilled;
                  const guideCls = isNext ? "field-guide-pulse" : "";
                  const anchorId = `sigfield-${field.id}`;

                  // Inline editable text input — renders on top of the field.
                  // Solid white bg so the underlying placeholder text in the
                  // PDF (e.g. "[CLIENT LEGAL NAME]") gets masked while signer
                  // is filling it in. Border tint indicates state.
                  if (isInlineText) {
                    return (
                      <div
                        key={field.id}
                        id={anchorId}
                        // The box matches the field's true size so its borders
                        // never cross neighboring document text; the before:*
                        // inset extends the TAP area invisibly and the click
                        // handler forwards focus into the input.
                        onClick={(e) =>
                          (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()
                        }
                        className={`absolute z-10 rounded-sm transition-all bg-white scroll-mt-28 before:absolute before:-inset-2.5 before:content-[''] ${guideCls} ${
                          isFilled
                            ? "border border-green-400 shadow-[0_0_0_2px_rgba(34,197,94,0.15)]"
                            : "border border-amber-400 shadow-[0_0_0_2px_rgba(245,158,11,0.15)]"
                        } ${isActive ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
                        style={{
                          left: `${field.x}%`,
                          top: `${field.y}%`,
                          width: `${field.width}%`,
                          height: `${field.height}%`,
                          minHeight: 20,
                        }}
                      >
                        <input
                          type="text"
                          value={field.value ?? ""}
                          placeholder={isActive ? "" : "Type here"}
                          onFocus={() => onFieldClick(field.id)}
                          onChange={(e) =>
                            onTextFieldChange(field.id, e.target.value)
                          }
                          className="w-full h-full bg-transparent px-1.5 text-xs sm:text-sm text-gray-900 font-medium placeholder:text-amber-700/70 placeholder:font-medium focus:outline-none"
                        />
                      </div>
                    );
                  }

                  // Dropdown — native <select> over the field's options. The
                  // selected option string is the field value.
                  if (field.type === "DROPDOWN") {
                    return (
                      <div
                        key={field.id}
                        id={anchorId}
                        onClick={(e) =>
                          (e.currentTarget.querySelector("select") as HTMLSelectElement | null)?.focus()
                        }
                        className={`absolute z-10 rounded-sm transition-all bg-white scroll-mt-28 before:absolute before:-inset-2.5 before:content-[''] ${guideCls} ${
                          isFilled
                            ? "border border-green-400 shadow-[0_0_0_2px_rgba(34,197,94,0.15)]"
                            : "border border-amber-400 shadow-[0_0_0_2px_rgba(245,158,11,0.15)]"
                        } ${isActive ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
                        style={{
                          left: `${field.x}%`,
                          top: `${field.y}%`,
                          width: `${field.width}%`,
                          height: `${field.height}%`,
                          minHeight: 20,
                        }}
                      >
                        <select
                          value={field.value ?? ""}
                          onFocus={() => onFieldClick(field.id)}
                          onChange={(e) =>
                            onTextFieldChange(field.id, e.target.value)
                          }
                          className="w-full h-full bg-transparent px-1 text-xs sm:text-sm text-gray-900 font-medium focus:outline-none"
                        >
                          <option value="" disabled>
                            {FIELD_LABELS.DROPDOWN}
                            {field.required ? " *" : ""}
                          </option>
                          {opts.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  // Radio — a vertical group of options. Selecting one sets the
                  // field value to that option string.
                  if (field.type === "RADIO") {
                    return (
                      <div
                        key={field.id}
                        id={anchorId}
                        className={`absolute z-10 rounded-sm transition-all bg-white/95 overflow-auto scroll-mt-28 ${guideCls} ${
                          isFilled
                            ? "border border-green-400 shadow-[0_0_0_2px_rgba(34,197,94,0.15)]"
                            : "border border-amber-400 shadow-[0_0_0_2px_rgba(245,158,11,0.15)]"
                        } ${isActive ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
                        style={{
                          left: `${field.x}%`,
                          top: `${field.y}%`,
                          width: `${field.width}%`,
                          height: `${field.height}%`,
                          minHeight: 20,
                        }}
                      >
                        <div className="flex flex-col gap-0.5 px-1.5 py-1">
                          {opts.map((opt) => (
                            <label
                              key={opt}
                              className="flex items-center gap-1.5 text-xs text-gray-900 font-medium cursor-pointer"
                            >
                              <input
                                type="radio"
                                name={`radio-${field.id}`}
                                checked={field.value === opt}
                                onFocus={() => onFieldClick(field.id)}
                                onChange={() =>
                                  onTextFieldChange(field.id, opt)
                                }
                                className="accent-primary"
                              />
                              <span className="truncate">{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  // Attachment — file picker that captures the chosen file's
                  // name as the field value (the sealed PDF annotates it; no
                  // inline embedding of the binary).
                  if (field.type === "ATTACHMENT") {
                    return (
                      <div
                        key={field.id}
                        id={anchorId}
                        className={`absolute z-10 rounded-sm transition-all bg-white flex items-center px-1.5 scroll-mt-28 ${guideCls} ${
                          isFilled
                            ? "border border-green-400 shadow-[0_0_0_2px_rgba(34,197,94,0.15)]"
                            : "border border-amber-400 shadow-[0_0_0_2px_rgba(245,158,11,0.15)]"
                        } ${isActive ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
                        style={{
                          left: `${field.x}%`,
                          top: `${field.y}%`,
                          width: `${field.width}%`,
                          height: `${field.height}%`,
                          minHeight: 20,
                        }}
                      >
                        {isFilled ? (
                          <span className="text-xs text-gray-900 font-medium truncate w-full">
                            📎 {field.value}
                          </span>
                        ) : (
                          <label className="text-xs text-amber-700 font-medium cursor-pointer truncate w-full">
                            {FIELD_LABELS.ATTACHMENT}
                            {field.required ? " *" : ""}
                            <input
                              type="file"
                              className="sr-only"
                              onFocus={() => onFieldClick(field.id)}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  onTextFieldChange(field.id, file.name);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={field.id}
                      id={anchorId}
                      onClick={() => onFieldClick(field.id)}
                      // The box matches the field's true size so its borders
                      // never read as strikethrough on neighboring document
                      // text; before:* expands the TAP target ~10px past the
                      // visual box instead of inflating the box itself.
                      // Filled signatures drop the border entirely — the ink
                      // is the content, exactly as it will seal.
                      className={`absolute flex items-center cursor-pointer rounded-sm transition-all z-10 scroll-mt-28 before:absolute before:-inset-2.5 before:content-[''] ${guideCls} ${
                        isFilled
                          ? isImageField
                            ? "border border-transparent hover:border-green-300/70 hover:bg-green-50/20"
                            : "border border-green-400/60 bg-green-50/30"
                          : "border border-amber-400/80 bg-amber-50/50 hover:bg-amber-100/60"
                      } ${isActive ? "ring-1 ring-blue-500" : ""}`}
                      style={{
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${field.width}%`,
                        height: `${field.height}%`,
                        minHeight: 20,
                      }}
                    >
                      {!isFilled && (
                        <span className="flex items-center gap-1 text-amber-700 text-xs font-medium select-none px-1.5 truncate">
                          {field.type === "SIGNATURE" && (
                            <svg
                              className="w-4 h-4 flex-shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                              />
                            </svg>
                          )}
                          {FIELD_LABELS[field.type]}
                          {field.required && (
                            <span className="text-red-500">*</span>
                          )}
                        </span>
                      )}

                      {isFilled && isImageField && (
                        // Bottom-left alignment mirrors how the seal step
                        // places the image in the sealed PDF — the preview is
                        // what the signer actually gets.
                        <img
                          src={field.value!}
                          alt={field.type}
                          className="w-full h-full object-contain object-left-bottom"
                          draggable={false}
                        />
                      )}

                      {isFilled && !isImageField && (
                        <span className="text-xs sm:text-sm text-gray-900 font-medium px-1.5 truncate w-full">
                          {field.type === "CHECKBOX" ? "✓" : field.value}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-center text-xs text-gray-400 py-1.5">
                Page {pageNum} of {numPages}
              </p>
            </div>
          );
        })}
      </Document>
    </div>
  );
}
