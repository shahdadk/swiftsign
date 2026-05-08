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
  | "CHECKBOX";

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
}

interface PdfViewerProps {
  documentId: string;
  token: string;
  pageCount: number;
  fields: FieldOverlay[];
  onFieldClick: (fieldId: string) => void;
  activeFieldId: string | null;
  onTextFieldChange: (fieldId: string, value: string) => void;
}

const FIELD_LABELS: Record<FieldType, string> = {
  SIGNATURE: "Sign here",
  INITIALS: "Initials",
  NAME: "Full Name",
  DATE: "Date",
  TEXT: "Text",
  CHECKBOX: "Check",
};

export function PdfViewer({
  documentId,
  token,
  fields,
  onFieldClick,
  activeFieldId,
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
                  renderTextLayer={false}
                />
                {pageFields.map((field) => {
                  const isFilled = !!field.value;
                  const isActive = field.id === activeFieldId;
                  const isImageField =
                    field.type === "SIGNATURE" || field.type === "INITIALS";
                  const isInlineText = field.type === "TEXT";

                  // Inline editable text input — renders on top of the field
                  if (isInlineText) {
                    return (
                      <div
                        key={field.id}
                        className={`absolute z-10 rounded-sm transition-all ${
                          isFilled
                            ? "border border-green-400/60 bg-green-50/30"
                            : "border border-amber-400/80 bg-amber-50/60"
                        } ${isActive ? "ring-1 ring-blue-500" : ""}`}
                        style={{
                          left: `${field.x}%`,
                          top: `${field.y}%`,
                          width: `${field.width}%`,
                          height: `${field.height}%`,
                          minHeight: 22,
                        }}
                      >
                        <input
                          type="text"
                          value={field.value ?? ""}
                          placeholder={isActive ? "" : FIELD_LABELS.TEXT}
                          onFocus={() => onFieldClick(field.id)}
                          onChange={(e) =>
                            onTextFieldChange(field.id, e.target.value)
                          }
                          className="w-full h-full bg-transparent px-1.5 text-xs sm:text-sm text-gray-900 font-medium placeholder:text-amber-700/70 placeholder:font-medium focus:outline-none"
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={field.id}
                      onClick={() => onFieldClick(field.id)}
                      className={`absolute flex items-center cursor-pointer rounded-sm transition-all z-10 ${
                        isFilled
                          ? "border border-green-400/60 bg-green-50/30"
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
                        <span className="flex items-center gap-1 text-amber-700 text-[10px] sm:text-xs font-medium select-none px-1.5 truncate">
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
                        <img
                          src={field.value!}
                          alt={field.type}
                          className="w-full h-full object-contain p-1"
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
