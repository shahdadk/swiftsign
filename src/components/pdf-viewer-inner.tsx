"use client";

import { useEffect, useRef, useState } from "react";

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

interface Props {
  pdfBase64: string;
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
  RADIO: "Choose one",
  DROPDOWN: "Select",
  ATTACHMENT: "Attach file",
};

export default function PdfViewerInner({
  pdfBase64,
  fields,
  onFieldClick,
  activeFieldId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [blobUrl] = useState<string>(() => {
    const byteChars = atob(pdfBase64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  });

  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  return (
    <div ref={containerRef} className="w-full">
      {/* PDF with field overlays */}
      <div className="relative w-full" style={{ aspectRatio: "8.5 / 11" }}>
        {/* Native PDF render */}
        <object
          data={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=0`}
          type="application/pdf"
          className="absolute inset-0 w-full h-full"
        >
          <embed
            src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            type="application/pdf"
            className="w-full h-full"
          />
        </object>

        {/* Field overlays on top of the PDF */}
        {fields.map((field) => {
          const isFilled = !!field.value;
          const isActive = field.id === activeFieldId;
          const isImageField = field.type === "SIGNATURE" || field.type === "INITIALS";

          return (
            <div
              key={field.id}
              onClick={() => onFieldClick(field.id)}
              className={`absolute flex items-center justify-center cursor-pointer rounded transition-all z-10 ${
                isFilled
                  ? "border-2 border-green-500 bg-green-50/60"
                  : "border-2 border-amber-400 bg-amber-100/70 hover:bg-amber-200/80 shadow-sm"
              } ${isActive ? "ring-2 ring-blue-500 ring-offset-1" : ""}`}
              style={{
                left: `${field.x}%`,
                top: `${field.y}%`,
                width: `${field.width}%`,
                height: `${field.height}%`,
                minHeight: 28,
              }}
            >
              {/* Unfilled */}
              {!isFilled && (
                <span className="flex items-center gap-1.5 text-amber-800 text-xs sm:text-sm font-medium select-none px-2 truncate">
                  {field.type === "SIGNATURE" && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                    </svg>
                  )}
                  {FIELD_LABELS[field.type]}
                  {field.required && <span className="text-red-500">*</span>}
                </span>
              )}

              {/* Filled — image */}
              {isFilled && isImageField && (
                <img src={field.value!} alt={field.type} className="w-full h-full object-contain p-1" draggable={false} />
              )}

              {/* Filled — text */}
              {isFilled && !isImageField && (
                <span className="text-xs sm:text-sm text-gray-800 font-medium px-2 truncate w-full text-center">
                  {field.type === "CHECKBOX" ? "\u2713" : field.value}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400 py-2 select-none">
        Page 1
      </p>
    </div>
  );
}
