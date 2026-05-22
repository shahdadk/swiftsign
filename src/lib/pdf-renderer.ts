import { createCanvas, type Canvas } from 'canvas';

// pdfjs-dist v5 legacy build for Node.js (no DOM dependencies)
// Loaded lazily via dynamic import since it's ESM-only
type PdfjsLib = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjsLibCache: PdfjsLib | null = null;
async function getPdfjsLib(): Promise<PdfjsLib> {
  if (pdfjsLibCache) return pdfjsLibCache;
  pdfjsLibCache = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsLibCache;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageImage {
  page: number;       // 1-indexed
  pngBuffer: Buffer;
  width: number;      // pixels
  height: number;     // pixels
}

export interface TextPosition {
  text: string;
  page: number;       // 1-indexed
  x: number;          // percentage (0-100)
  y: number;          // percentage (0-100)
  width: number;      // percentage (0-100)
}

export interface AnchorResult {
  page: number;       // 1-indexed
  x: number;          // percentage (0-100) — position of anchor text
  y: number;          // percentage (0-100) — position of anchor text
  xEnd: number;       // percentage (0-100) — right edge of anchor text
}

// ---------------------------------------------------------------------------
// Canvas factory for server-side rendering with node-canvas
// ---------------------------------------------------------------------------

class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas: Canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }

  reset(canvasAndContext: { canvas: Canvas }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: { canvas: Canvas }) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadDocument(pdfBuffer: Buffer) {
  try {
    const pdfjsLib = await getPdfjsLib();
    // Point worker to the actual file in node_modules
    const path = await import('path');
    const workerPath = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
    return await pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      // @ts-expect-error canvasFactory is supported in the legacy Node build but not declared
      canvasFactory: new NodeCanvasFactory(),
      isEvalSupported: false,
    }).promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load PDF: ${message}`);
  }
}

// A loaded pdfjs document. Use `loadPdf` to create one; the caller MUST call
// `.destroy()` when done (or use `withLoadedPdf` which does it for you).
type LoadedPdfDoc = Awaited<ReturnType<typeof loadDocument>>;

/**
 * Load a PDF once and share the parsed document across multiple operations.
 *
 * The caller is responsible for calling `doc.destroy()` when done — usually
 * easier to use `withLoadedPdf(buf, async (doc) => ...)` instead.
 */
export async function loadPdf(pdfBuffer: Buffer): Promise<LoadedPdfDoc> {
  return loadDocument(pdfBuffer);
}

/**
 * Convenience wrapper: load a PDF once, run `fn` with the doc, and destroy
 * the doc on the way out (even if `fn` throws).
 */
export async function withLoadedPdf<T>(
  pdfBuffer: Buffer,
  fn: (doc: LoadedPdfDoc) => Promise<T>,
): Promise<T> {
  const doc = await loadDocument(pdfBuffer);
  try {
    return await fn(doc);
  } finally {
    doc.destroy();
  }
}

// ---------------------------------------------------------------------------
// renderPdfToImages
// ---------------------------------------------------------------------------

export async function renderPdfToImages(
  source: Buffer | LoadedPdfDoc,
  scale = 2,
): Promise<PageImage[]> {
  const ownsDoc = Buffer.isBuffer(source);
  const doc: LoadedPdfDoc = ownsDoc ? await loadDocument(source as Buffer) : (source as LoadedPdfDoc);
  const images: PageImage[] = [];

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });

      const factory = new NodeCanvasFactory();
      const canvasAndContext = factory.create(
        Math.floor(viewport.width),
        Math.floor(viewport.height),
      );

      try {
        await page.render({
          // @ts-expect-error node-canvas context has fewer methods than browser CanvasRenderingContext2D, but pdfjs only uses the supported ones
          canvasContext: canvasAndContext.context,
          viewport,
        }).promise;

        const pngBuffer = canvasAndContext.canvas.toBuffer('image/png');

        images.push({
          page: i,
          pngBuffer,
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height),
        });
      } catch (err) {
        throw new Error(
          `Failed to render page ${i}: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        factory.destroy(canvasAndContext);
      }
    }
  } finally {
    if (ownsDoc) doc.destroy();
  }

  return images;
}

// ---------------------------------------------------------------------------
// extractTextPositions
// ---------------------------------------------------------------------------

export async function extractTextPositions(
  source: Buffer | LoadedPdfDoc,
): Promise<TextPosition[]> {
  const ownsDoc = Buffer.isBuffer(source);
  const doc: LoadedPdfDoc = ownsDoc ? await loadDocument(source as Buffer) : (source as LoadedPdfDoc);
  const positions: TextPosition[] = [];

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const pageWidth = viewport.width;
      const pageHeight = viewport.height;

      const textContent = await page.getTextContent();

      for (const item of textContent.items) {
        // Skip items without string content (e.g. marked content spans)
        if (!('str' in item) || !item.str) continue;

        // transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]
        const tx = item.transform[4] as number;
        const ty = item.transform[5] as number;

        // PDF origin is bottom-left; convert to top-left percentage coords
        const xPercent = (tx / pageWidth) * 100;
        const yPercent = (1 - ty / pageHeight) * 100;

        // Estimate text width from item.width or string length
        const itemWidth = (item as { width?: number }).width ?? ((item.str as string).length * 6);
        const widthPercent = (itemWidth / pageWidth) * 100;

        positions.push({
          text: item.str as string,
          page: i,
          x: Math.round(xPercent * 100) / 100,
          y: Math.round(yPercent * 100) / 100,
          width: Math.round(widthPercent * 100) / 100,
        });
      }
    }
  } finally {
    if (ownsDoc) doc.destroy();
  }

  return positions;
}

// ---------------------------------------------------------------------------
// findAnchorPosition
// ---------------------------------------------------------------------------

export async function findAnchorPosition(
  pdfBuffer: Buffer,
  anchor: string,
): Promise<AnchorResult | null> {
  const positions = await extractTextPositions(pdfBuffer);
  const needle = anchor.toLowerCase();

  // Find the LAST occurrence — signature blocks are always at the end of the document
  let lastMatch: AnchorResult | null = null;
  for (const pos of positions) {
    if (pos.text.toLowerCase().includes(needle)) {
      lastMatch = {
        page: pos.page,
        x: pos.x,
        y: pos.y,
        xEnd: pos.x + pos.width,
      };
    }
  }

  return lastMatch;
}
