"use client";

import { useState } from "react";

type FieldType = "SIGNATURE" | "NAME" | "DATE" | "TEXT" | "INITIALS" | "CHECKBOX";

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
  pageCount,
  fields,
  onFieldClick,
  activeFieldId,
}: PdfViewerProps) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <div className="w-full space-y-2">
      {pages.map((pageNum) => {
        const pageFields = fields.filter((f) => f.page === pageNum);
        return (
          <div key={pageNum}>
            <div className="relative">
              <PageImage
                documentId={documentId}
                token={token}
                pageNum={pageNum}
              />
              {/* Field overlays on top of the page image */}
              {pageFields.map((field) => {
                const isFilled = !!field.value;
                const isActive = field.id === activeFieldId;
                const isImageField =
                  field.type === "SIGNATURE" || field.type === "INITIALS";

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
                    {/* Unfilled */}
                    {!isFilled && (
                      <span className="flex items-center gap-1 text-amber-600 text-[9px] sm:text-xs font-medium select-none px-1.5 truncate">
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

                    {/* Filled -- image */}
                    {isFilled && isImageField && (
                      <img
                        src={field.value!}
                        alt={field.type}
                        className="w-full h-full object-contain p-1"
                        draggable={false}
                      />
                    )}

                    {/* Filled -- text */}
                    {isFilled && !isImageField && (
                      <span className="text-[9px] sm:text-xs text-gray-700 font-medium px-1.5 truncate w-full">
                        {field.type === "CHECKBOX" ? "\u2713" : field.value}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-center text-xs text-gray-400 py-1.5">
              Page {pageNum} of {pageCount}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function PageImage({
  documentId,
  token,
  pageNum,
}: {
  documentId: string;
  token: string;
  pageNum: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [cacheBust] = useState(() => Date.now());

  return (
    <>
      {!loaded && !error && (
        <div className="w-full aspect-[8.5/11] bg-gray-200 rounded-lg animate-pulse" />
      )}
      {error && (
        <div className="w-full aspect-[8.5/11] bg-gray-100 rounded-lg flex items-center justify-center">
          <p className="text-sm text-gray-400">Failed to load page {pageNum}</p>
        </div>
      )}
      <img
        src={`/api/documents/${documentId}/pages/${pageNum}?token=${token}&t=${cacheBust}`}
        alt={`Page ${pageNum}`}
        className={`w-full h-auto block ${!loaded ? "hidden" : ""}`}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true);
          setLoaded(true);
        }}
      />
    </>
  );
}
