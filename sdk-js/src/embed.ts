/**
 * Detail passed to {@link EmbedOptions.onComplete} when the recipient finishes
 * signing inside the embedded iframe.
 */
export interface EmbedCompletedEvent {
  envelopeId?: string;
}

/** Options for {@link embed}. */
export interface EmbedOptions {
  /** Embedded signing URL from {@link Envelopes.createEmbeddedUrl}. */
  url: string;
  /** Target element, or a CSS selector resolving to one. */
  container: HTMLElement | string;
  /** Called when the iframe posts `swiftsign:completed`. */
  onComplete?: (event: EmbedCompletedEvent) => void;
  /** Override the iframe `title` (default: `"SwiftSign signing"`). */
  title?: string;
}

/** Handle returned by {@link embed}; call {@link EmbedHandle.destroy} to tear down. */
export interface EmbedHandle {
  /** The injected iframe element. */
  iframe: HTMLIFrameElement;
  /** Remove the iframe and detach the message listener. */
  destroy(): void;
}

/**
 * Mount the SwiftSign signing experience in an iframe and invoke `onComplete`
 * when the signer finishes. Mirrors the `swiftsign:completed` postMessage the
 * signing page emits.
 *
 * Browser-only — throws if called without a DOM.
 *
 * @example
 * ```ts
 * import { embed } from "swiftsign";
 *
 * const { url } = await swiftsign.envelopes.createEmbeddedUrl(envId, recipientId);
 * embed({
 *   url,
 *   container: "#sign",
 *   onComplete: ({ envelopeId }) => console.log("signed", envelopeId),
 * });
 * ```
 */
export function embed(options: EmbedOptions): EmbedHandle {
  if (typeof document === "undefined" || typeof window === "undefined") {
    throw new Error("swiftsign.embed() can only run in a browser environment.");
  }

  const container =
    typeof options.container === "string"
      ? document.querySelector<HTMLElement>(options.container)
      : options.container;

  if (!container) {
    throw new Error(
      `swiftsign.embed(): container ${
        typeof options.container === "string" ? `"${options.container}"` : ""
      } not found.`
    );
  }

  const iframe = document.createElement("iframe");
  iframe.src = options.url;
  iframe.title = options.title ?? "SwiftSign signing";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.allow = "clipboard-write";

  // Only react to messages coming from this iframe's window.
  const origin = safeOrigin(options.url);
  const onMessage = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow) return;
    if (origin && event.origin !== origin) return;
    const data = event.data as { type?: string; envelopeId?: string } | undefined;
    if (data && data.type === "swiftsign:completed") {
      options.onComplete?.({ envelopeId: data.envelopeId });
    }
  };

  window.addEventListener("message", onMessage);
  container.appendChild(iframe);

  return {
    iframe,
    destroy() {
      window.removeEventListener("message", onMessage);
      iframe.remove();
    },
  };
}

/** Parse the origin from a URL, returning undefined if it can't be parsed. */
function safeOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
