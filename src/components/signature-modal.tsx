"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface SignatureModalProps {
  fieldType: "signature" | "initials";
  onAdopt: (dataUrl: string) => void;
  onCancel: () => void;
}

type Tab = "draw" | "type" | "upload";

export function SignatureModal({
  fieldType,
  onAdopt,
  onCancel,
}: SignatureModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("draw");
  const [drawHasContent, setDrawHasContent] = useState(false);

  // Draw state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Type state
  const [typedText, setTypedText] = useState("");

  // Upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive hasContent from current tab + state (no effect needed)
  const hasContent =
    activeTab === "draw"
      ? drawHasContent
      : activeTab === "type"
        ? typedText.trim().length > 0
        : uploadedImage !== null;

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || activeTab !== "draw") return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match display size
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Configure drawing style
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [activeTab]);

  const getCanvasPoint = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;

      if ("touches" in e) {
        if (e.touches.length === 0) return null;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const point = getCanvasPoint(e);
      if (!point) return;

      isDrawing.current = true;
      lastPoint.current = point;

      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
      }
    },
    [getCanvasPoint]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing.current) return;

      const point = getCanvasPoint(e);
      if (!point) return;

      const ctx = canvasRef.current?.getContext("2d");
      if (ctx && lastPoint.current) {
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        lastPoint.current = point;
        setDrawHasContent(true);
      }
    },
    [getCanvasPoint]
  );

  const stopDrawing = useCallback(() => {
    isDrawing.current = false;
    lastPoint.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setDrawHasContent(false);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAdopt = () => {
    let dataUrl: string | null = null;

    if (activeTab === "draw") {
      const canvas = canvasRef.current;
      if (canvas) {
        dataUrl = canvas.toDataURL("image/png");
      }
    } else if (activeTab === "type") {
      // Render typed text to canvas
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 400, 100);
        ctx.fillStyle = "#1a1a1a";
        ctx.font = "italic 36px 'Georgia', 'Times New Roman', serif";
        ctx.textBaseline = "middle";
        ctx.fillText(typedText, 16, 50);
        dataUrl = canvas.toDataURL("image/png");
      }
    } else if (activeTab === "upload") {
      dataUrl = uploadedImage;
    }

    if (dataUrl) {
      onAdopt(dataUrl);
    }
  };

  const label =
    fieldType === "initials" ? "Initials" : "Signature";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold">
            Adopt Your {label}
          </h3>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-400"
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

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(["draw", "type", "upload"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5">
          {activeTab === "draw" && (
            <div>
              <div className="relative border-2 border-dashed border-gray-200 rounded-lg overflow-hidden bg-white">
                <canvas
                  ref={canvasRef}
                  className="signature-canvas w-full block h-56 sm:h-44"
                  style={{
                    touchAction: "none",
                    WebkitUserSelect: "none",
                    userSelect: "none",
                  }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  onTouchCancel={stopDrawing}
                />
                {/* Guide line */}
                <div className="absolute bottom-10 left-6 right-6 border-b border-gray-200 pointer-events-none" />
              </div>
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-400">
                  Draw your {label.toLowerCase()} above
                </p>
                <button
                  onClick={clearCanvas}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {activeTab === "type" && (
            <div>
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={`Type your ${label.toLowerCase()}...`}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                autoFocus
              />
              {/* Preview */}
              {typedText && (
                <div className="mt-4 border-2 border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
                  <p className="text-xs text-gray-400 mb-2">Preview</p>
                  <p
                    className="text-3xl text-gray-900"
                    style={{
                      fontFamily:
                        "'Georgia', 'Times New Roman', serif",
                      fontStyle: "italic",
                    }}
                  >
                    {typedText}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "upload" && (
            <div>
              {uploadedImage ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
                  <img
                    src={uploadedImage}
                    alt="Uploaded signature"
                    className="max-h-32 mx-auto object-contain"
                  />
                  <div className="flex justify-center mt-3">
                    <button
                      onClick={() => {
                        setUploadedImage(null);
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-gray-300 transition-colors"
                >
                  <svg
                    className="w-8 h-8 text-gray-300 mx-auto mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  <p className="text-sm text-gray-500">
                    Click to upload an image
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PNG or JPEG
                  </p>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="h-11 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdopt}
            disabled={!hasContent}
            className="h-11 px-6 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Adopt and Sign
          </button>
        </div>
      </div>
    </div>
  );
}
