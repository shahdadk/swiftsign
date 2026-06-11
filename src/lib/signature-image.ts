// Client-side signature image pipeline shared by the draw / type / upload
// tabs of the signature modal.
//
// Every adopted signature leaves here as a TRANSPARENT, ink-tight PNG:
//  - no opaque background (an opaque box stamped on a PDF covers the
//    signature line and any text near it),
//  - cropped to the ink bounding box (so the seal step scales the ink, not
//    empty margins, and the signature lands large and ON the line).
//
// The server runs the same normalization defensively at seal time
// (src/lib/seal.ts) for legacy adoptions and API-submitted images.

export interface ProcessedSignature {
  dataUrl: string;
  width: number;
  height: number;
}

interface ProcessOptions {
  /** Strip a light, uniform background (scanned/photographed signatures). */
  removeBackground?: boolean;
  /** Transparent padding around the ink bounding box, in px. */
  padding?: number;
  maxWidth?: number;
  maxHeight?: number;
}

const ALPHA_INK_THRESHOLD = 24;

function getContext(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return ctx;
}

/**
 * Median paper color sampled from the border ring of the image. Signatures
 * are drawn/scanned on paper; the border is overwhelmingly background.
 */
function sampleBackgroundColor(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { r: number; g: number; b: number } | null {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const push = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 200) return; // ignore already-transparent pixels
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  };
  const stepX = Math.max(1, Math.floor(width / 64));
  const stepY = Math.max(1, Math.floor(height / 64));
  for (let x = 0; x < width; x += stepX) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += stepY) {
    push(0, y);
    push(width - 1, y);
  }
  if (rs.length < 8) return null;
  const median = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  return { r: median(rs), g: median(gs), b: median(bs) };
}

/**
 * Convert background-colored pixels to transparency in place. Pixels close to
 * the paper color become fully transparent; pixels far from it keep their
 * alpha; the ramp between preserves anti-aliased stroke edges.
 */
function removeBackgroundInPlace(
  data: Uint8ClampedArray,
  width: number,
  height: number
): boolean {
  const paper = sampleBackgroundColor(data, width, height);
  if (!paper) return false;
  const luminance = 0.299 * paper.r + 0.587 * paper.g + 0.114 * paper.b;
  // Only strip LIGHT backgrounds. A dark background means the heuristic
  // (dark ink on light paper) doesn't hold — leave the image alone.
  if (luminance < 160) return false;

  const NEAR = 10; // within this distance of paper -> fully transparent
  const FAR = 72; // beyond this distance -> fully opaque
  const scale = 255 / (FAR - NEAR);
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.max(
      Math.abs(data[i] - paper.r),
      Math.abs(data[i + 1] - paper.g),
      Math.abs(data[i + 2] - paper.b)
    );
    const a = Math.max(0, Math.min(255, (d - NEAR) * scale));
    if (a < data[i + 3]) data[i + 3] = a;
  }
  return true;
}

function inkBoundingBox(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_INK_THRESHOLD) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x0, y0, x1, y1 };
}

/**
 * Normalize any signature source (drawn canvas, typed render, uploaded image)
 * into a transparent, ink-tight PNG data URL. Returns null when there is no
 * visible ink.
 */
export function processSignatureSource(
  source: HTMLCanvasElement | HTMLImageElement,
  opts: ProcessOptions = {}
): ProcessedSignature | null {
  const {
    removeBackground = false,
    padding = 10,
    maxWidth = 1400,
    maxHeight = 700,
  } = opts;

  const srcW =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!srcW || !srcH) return null;

  const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const ctx = getContext(work);
  ctx.drawImage(source, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  if (removeBackground) {
    // Skip when the image already carries real transparency — it is a clean
    // cutout and the heuristic would only eat anti-aliased edges.
    let transparentish = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) transparentish++;
    }
    const alreadyTransparent = transparentish / (data.length / 4) > 0.02;
    if (!alreadyTransparent) removeBackgroundInPlace(data, w, h);
  }

  const bbox = inkBoundingBox(data, w, h);
  if (!bbox) return null;

  ctx.putImageData(imageData, 0, 0);

  const cropX = Math.max(0, bbox.x0 - padding);
  const cropY = Math.max(0, bbox.y0 - padding);
  const cropW = Math.min(w, bbox.x1 + padding + 1) - cropX;
  const cropH = Math.min(h, bbox.y1 + padding + 1) - cropY;

  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  getContext(out).drawImage(
    work,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH
  );

  return { dataUrl: out.toDataURL("image/png"), width: cropW, height: cropH };
}

/** Render typed text as transparent signature ink in the given font. */
export function renderTypedSignature(
  text: string,
  fontFamily: string
): HTMLCanvasElement {
  const fontSize = 96;
  const font = `${fontSize}px ${fontFamily}`;
  const measure = document.createElement("canvas");
  const mctx = getContext(measure);
  mctx.font = font;
  const metrics = mctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.3;

  const pad = 24;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(metrics.width + pad * 2);
  canvas.height = Math.ceil(ascent + descent + pad * 2);
  const ctx = getContext(canvas);
  ctx.font = font;
  ctx.fillStyle = "#1b1f27";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, pad, pad + ascent);
  return canvas;
}

/** Decode a data URL / object URL into an image element. */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = src;
  });
}
