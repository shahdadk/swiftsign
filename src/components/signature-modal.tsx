"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  processSignatureSource,
  renderTypedSignature,
  loadImageElement,
} from "@/lib/signature-image";

interface SignatureModalProps {
  fieldType: "signature" | "initials";
  /** Recipient name — pre-fills the typed style and labels the modal. */
  signerName?: string;
  onAdopt: (dataUrl: string) => void;
  onCancel: () => void;
}

type Tab = "draw" | "type" | "upload";

interface StrokePoint {
  x: number;
  y: number;
  /** Pointer pressure (0..1, 0.5 = unknown). */
  p: number;
  t: number;
}

interface Stroke {
  points: StrokePoint[];
}

const INK = "#1b1f27";
const BASE_WIDTH = 2.6;
const MIN_WIDTH = 1.5;
const MAX_WIDTH = 3.6;
const EXPORT_SCALE = 2;

const SIGNATURE_FONTS = [
  { id: "dancing", label: "Flowing", cssVar: "--font-sig-dancing" },
  { id: "caveat", label: "Casual", cssVar: "--font-sig-caveat" },
  { id: "vibes", label: "Elegant", cssVar: "--font-sig-vibes" },
  { id: "apple", label: "Handwritten", cssVar: "--font-sig-apple" },
] as const;

type FontId = (typeof SIGNATURE_FONTS)[number]["id"];

function strokeWidthFor(
  prev: StrokePoint,
  next: StrokePoint,
  lastWidth: number
): number {
  const dist = Math.hypot(next.x - prev.x, next.y - prev.y);
  const dt = Math.max(1, next.t - prev.t);
  const speed = dist / dt; // px per ms
  let target = BASE_WIDTH - speed * 1.1;
  // Real pen pressure modulates width; mouse/touch report ~0.5 constant.
  if (next.p !== 0.5) target *= 0.6 + next.p * 0.8;
  target = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, target));
  return lastWidth + (target - lastWidth) * 0.35;
}

/** Draw one stroke with midpoint-quadratic smoothing + velocity width. */
function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = stroke.points;
  if (pts.length === 0) return;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (pts.length < 3) {
    // A tap: render a dot so quick initials/dots register.
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, BASE_WIDTH * 0.7, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  let width = BASE_WIDTH;
  for (let i = 1; i < pts.length - 1; i++) {
    const mid1 = {
      x: (pts[i - 1].x + pts[i].x) / 2,
      y: (pts[i - 1].y + pts[i].y) / 2,
    };
    const mid2 = {
      x: (pts[i].x + pts[i + 1].x) / 2,
      y: (pts[i].y + pts[i + 1].y) / 2,
    };
    width = strokeWidthFor(pts[i - 1], pts[i], width);
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.moveTo(mid1.x, mid1.y);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mid2.x, mid2.y);
    ctx.stroke();
  }
}

export function SignatureModal({
  fieldType,
  signerName,
  onAdopt,
  onCancel,
}: SignatureModalProps) {
  const label = fieldType === "initials" ? "initials" : "signature";
  const defaultTyped = useMemo(() => {
    if (!signerName) return "";
    if (fieldType === "initials") {
      return signerName
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0]!.toUpperCase())
        .join("");
    }
    return signerName;
  }, [signerName, fieldType]);

  // Touch-first devices get the draw tab; mouse users get instant typed
  // styles (drawing with a mouse is the weakest input).
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches
      ? "type"
      : "draw"
  );

  // ── Draw state ──────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasBoxRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeStroke = useRef<Stroke | null>(null);
  const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const [strokeCount, setStrokeCount] = useState(0);

  // ── Type state ──────────────────────────────────────────────
  const [typedText, setTypedText] = useState(defaultTyped);
  const [fontId, setFontId] = useState<FontId>("dancing");

  // ── Upload state ────────────────────────────────────────────
  const [uploadedSrc, setUploadedSrc] = useState<string | null>(null);
  const [processedUpload, setProcessedUpload] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [adopting, setAdopting] = useState(false);

  const hasContent =
    activeTab === "draw"
      ? strokeCount > 0
      : activeTab === "type"
        ? typedText.trim().length > 0
        : processedUpload !== null;

  // ── Canvas lifecycle: DPR-correct sizing + stroke-preserving resize ──
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { w, h } = canvasSize.current;
    ctx.clearRect(0, 0, w, h);
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke);
    if (activeStroke.current) drawStroke(ctx, activeStroke.current);
  }, []);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const prev = canvasSize.current;
    // Rotation / sheet resize: rescale existing ink so nothing is lost.
    if (prev.w > 0 && prev.h > 0 && (prev.w !== rect.width || prev.h !== rect.height)) {
      const sx = rect.width / prev.w;
      const sy = rect.height / prev.h;
      for (const stroke of strokesRef.current) {
        for (const pt of stroke.points) {
          pt.x *= sx;
          pt.y *= sy;
        }
      }
    }
    canvasSize.current = { w: rect.width, h: rect.height };
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }, [redraw]);

  useEffect(() => {
    if (activeTab !== "draw") return;
    setupCanvas();
    const box = canvasBoxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => setupCanvas());
    ro.observe(box);
    return () => ro.disconnect();
  }, [activeTab, setupCanvas]);

  // ── Pointer handlers (mouse, touch, pen — one path) ─────────
  const pointFromEvent = useCallback((e: React.PointerEvent): StrokePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      p: e.pressure || 0.5,
      t: e.timeStamp,
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      e.preventDefault();
      canvasRef.current?.setPointerCapture(e.pointerId);
      const pt = pointFromEvent(e);
      if (!pt) return;
      activeStroke.current = { points: [pt] };
    },
    [pointFromEvent]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeStroke.current || !e.isPrimary) return;
      e.preventDefault();
      const native = e.nativeEvent;
      const events =
        typeof native.getCoalescedEvents === "function" && native.getCoalescedEvents().length
          ? native.getCoalescedEvents()
          : [native];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      for (const ev of events) {
        activeStroke.current.points.push({
          x: ev.clientX - rect.left,
          y: ev.clientY - rect.top,
          p: ev.pressure || 0.5,
          t: ev.timeStamp,
        });
      }
      redraw();
    },
    [redraw]
  );

  const handlePointerUp = useCallback(() => {
    if (!activeStroke.current) return;
    strokesRef.current.push(activeStroke.current);
    activeStroke.current = null;
    setStrokeCount(strokesRef.current.length);
    redraw();
  }, [redraw]);

  const handleUndo = useCallback(() => {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redraw();
  }, [redraw]);

  const handleClear = useCallback(() => {
    strokesRef.current = [];
    activeStroke.current = null;
    setStrokeCount(0);
    redraw();
  }, [redraw]);

  // ── Upload processing ───────────────────────────────────────
  const processUpload = useCallback(async (src: string, strip: boolean) => {
    try {
      const img = await loadImageElement(src);
      const processed = processSignatureSource(img, {
        removeBackground: strip,
        padding: 14,
      });
      if (!processed) {
        setUploadError("We couldn't find a signature in that image. Try a darker pen or a clearer photo.");
        setProcessedUpload(null);
        return;
      }
      setUploadError(null);
      setProcessedUpload(processed.dataUrl);
    } catch {
      setUploadError("Could not read that image. Use a PNG or JPEG.");
      setProcessedUpload(null);
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setUploadedSrc(src);
      void processUpload(src, removeBg);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBgToggle = (next: boolean) => {
    setRemoveBg(next);
    if (uploadedSrc) void processUpload(uploadedSrc, next);
  };

  const resetUpload = () => {
    setUploadedSrc(null);
    setProcessedUpload(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Adopt ───────────────────────────────────────────────────
  const fontFamilyFor = (id: FontId) => {
    const cssVar = SIGNATURE_FONTS.find((f) => f.id === id)!.cssVar;
    const fam = getComputedStyle(document.documentElement)
      .getPropertyValue(cssVar)
      .trim();
    return fam || "cursive";
  };

  const handleAdopt = async () => {
    setAdopting(true);
    try {
      let dataUrl: string | null = null;

      if (activeTab === "draw" && strokesRef.current.length > 0) {
        const { w, h } = canvasSize.current;
        const offscreen = document.createElement("canvas");
        offscreen.width = Math.round(w * EXPORT_SCALE);
        offscreen.height = Math.round(h * EXPORT_SCALE);
        const ctx = offscreen.getContext("2d");
        if (ctx) {
          ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
          for (const stroke of strokesRef.current) drawStroke(ctx, stroke);
          dataUrl =
            processSignatureSource(offscreen, { padding: 12 })?.dataUrl ?? null;
        }
      } else if (activeTab === "type") {
        const family = fontFamilyFor(fontId);
        try {
          await document.fonts.load(`96px ${family}`, typedText);
        } catch {
          // Font load failures fall back to the canvas default family.
        }
        const canvas = renderTypedSignature(typedText.trim(), family);
        dataUrl = processSignatureSource(canvas, { padding: 12 })?.dataUrl ?? null;
      } else if (activeTab === "upload") {
        dataUrl = processedUpload;
      }

      if (dataUrl) onAdopt(dataUrl);
    } finally {
      setAdopting(false);
    }
  };

  // ── Dialog behavior: Escape closes, focus moves in ──────────
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Adopt your ${label}`}
        tabIndex={-1}
        className="relative bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col outline-none pb-safe"
      >
        {/* Sheet handle (mobile) */}
        <div className="sm:hidden pt-2.5 flex justify-center">
          <div className="w-9 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 sm:py-4 sm:border-b sm:border-gray-100">
          <div>
            <h3 className="text-lg font-semibold capitalize">
              Add your {label}
            </h3>
            {signerName && (
              <p className="text-xs text-gray-400 mt-0.5">
                Signing as {signerName}
              </p>
            )}
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
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
        <div className="flex border-b border-gray-100 px-2">
          {(["draw", "type", "upload"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium capitalize transition-colors -mb-px border-b-2 ${
                activeTab === tab
                  ? "text-primary border-primary"
                  : "text-gray-400 border-transparent hover:text-gray-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto">
          {activeTab === "draw" && (
            <div>
              <div
                ref={canvasBoxRef}
                className="relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-white"
              >
                <canvas
                  ref={canvasRef}
                  className="w-full block cursor-crosshair h-56 sm:h-48"
                  style={{
                    touchAction: "none",
                    WebkitUserSelect: "none",
                    userSelect: "none",
                  }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                />
                {/* Baseline guide */}
                <div className="absolute bottom-10 left-6 right-6 pointer-events-none">
                  <div className="border-b border-gray-200" />
                  <span className="absolute -top-2.5 -left-1 text-gray-300 text-sm select-none">
                    ✕
                  </span>
                </div>
                {strokeCount === 0 && (
                  <p className="absolute inset-x-0 top-1/3 text-center text-sm text-gray-300 pointer-events-none select-none">
                    Draw your {label} here
                  </p>
                )}
              </div>
              <div className="flex justify-between items-center mt-2.5">
                <p className="text-xs text-gray-400">
                  Draw with your mouse, finger, or stylus
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleUndo}
                    disabled={strokeCount === 0}
                    className="text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-colors"
                  >
                    Undo
                  </button>
                  <button
                    onClick={handleClear}
                    disabled={strokeCount === 0}
                    className="text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-30 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "type" && (
            <div>
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={`Type your ${label}...`}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                autoFocus={typedText === ""}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
                {SIGNATURE_FONTS.map((font) => (
                  <button
                    key={font.id}
                    onClick={() => setFontId(font.id)}
                    disabled={!typedText.trim()}
                    className={`relative rounded-xl border px-4 pt-5 pb-2 text-left transition-all disabled:opacity-40 ${
                      fontId === font.id
                        ? "border-primary ring-2 ring-primary/20 bg-blue-50/40"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span
                      className="block text-3xl leading-tight text-gray-900 truncate min-h-[2.4rem]"
                      style={{ fontFamily: `var(${font.cssVar}), cursive` }}
                    >
                      {typedText.trim() || "Your name"}
                    </span>
                    <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                      {fontId === font.id && (
                        <svg
                          className="w-3.5 h-3.5 text-primary"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m4.5 12.75 6 6 9-13.5"
                          />
                        </svg>
                      )}
                      {font.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "upload" && (
            <div>
              {processedUpload ? (
                <div>
                  <div className="alpha-checker border-2 border-dashed border-gray-200 rounded-xl p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={processedUpload}
                      alt="Your signature with background removed"
                      className="max-h-32 mx-auto object-contain"
                      draggable={false}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={removeBg}
                        onChange={(e) => handleRemoveBgToggle(e.target.checked)}
                        className="accent-primary w-3.5 h-3.5"
                      />
                      Remove background
                    </label>
                    <button
                      onClick={resetUpload}
                      className="text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors"
                    >
                      Use a different image
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    The checkered area shows what becomes transparent so your{" "}
                    {label} never covers the document underneath.
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-gray-300 transition-colors"
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
                    Upload a photo of your {label}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PNG or JPEG · white paper backgrounds removed automatically
                  </p>
                </button>
              )}
              {uploadError && (
                <p className="text-xs text-red-600 mt-2">{uploadError}</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 mt-auto">
          <button
            onClick={onCancel}
            className="h-11 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdopt}
            disabled={!hasContent || adopting}
            className="h-11 px-6 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {adopting ? "Adopting..." : "Adopt and sign"}
          </button>
        </div>
      </div>
    </div>
  );
}
