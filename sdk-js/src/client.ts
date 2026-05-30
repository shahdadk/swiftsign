import { errorFromResponse } from "./errors.js";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

/** Lifecycle state of an envelope. */
export type EnvelopeStatus = "DRAFT" | "SENT" | "COMPLETED" | "DECLINED" | "VOIDED";

/** Role a recipient plays on an envelope. */
export type RecipientRole = "SIGNER" | "CC";

/** Field types that can be placed on a document. */
export type FieldType =
  | "SIGNATURE"
  | "NAME"
  | "DATE"
  | "TEXT"
  | "INITIALS"
  | "CHECKBOX"
  | "RADIO"
  | "DROPDOWN"
  | "ATTACHMENT";

/** Account mode of an API key. Test sends are watermarked and free. */
export type Mode = "test" | "live";

/** Self-serve plans you can upgrade to. */
export type Plan = "PRO" | "TEAM";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** A document to upload, as base64-encoded PDF bytes. */
export interface DocumentInput {
  /** File name shown to recipients, e.g. `"Agreement.pdf"`. */
  name: string;
  /** Base64-encoded PDF content (no data-URL prefix). */
  base64: string;
}

/** A recipient on an envelope. */
export interface RecipientInput {
  name: string;
  email: string;
  /** Defaults to `"SIGNER"`. */
  role?: RecipientRole;
  /** Signing order; recipients with the same order sign in parallel. Defaults to `1`. */
  routingOrder?: number;
}

/**
 * A field placed on a document for a recipient. Coordinates are percentages
 * (0–100) of the page with a top-left origin. Either supply `page`/`x`/`y`
 * explicitly, or pass an `anchor` string to position relative to matching text.
 */
export interface FieldInput {
  /** Index into the `recipients` array this field belongs to. */
  recipientIndex: number;
  type: FieldType;
  /** Index into the `documents` array this field is placed on. */
  document: number;
  /** 1-indexed page. Defaults to `1`. Ignored when `anchor` resolves a page. */
  page?: number;
  /** X position as a percentage (0–100) of page width. Defaults to `0`. */
  x?: number;
  /** Y position as a percentage (0–100) of page height. Defaults to `0`. */
  y?: number;
  /** Width as a percentage (0–100) of page width. Defaults to `30`. */
  width?: number;
  /** Height as a percentage (0–100) of page height. Defaults to `5`. */
  height?: number;
  /** Text to anchor against; the field is placed next to the last match. */
  anchor?: string;
  /** Vertical nudge (percentage points) applied when positioning via `anchor`. */
  yOffset?: number;
  /** Choices for `DROPDOWN` / `RADIO` fields. */
  options?: string[];
}

/** Create an envelope inline from documents, recipients, and fields. */
export interface InlineEnvelopeInput {
  subject: string;
  message?: string;
  documents: DocumentInput[];
  recipients: RecipientInput[];
  fields?: FieldInput[];
}

/** Assignment of a real person to a template role. Keyed by `roleName`. */
export interface RoleAssignment {
  name: string;
  email: string;
}

/** Create an envelope from a saved template. */
export interface TemplateEnvelopeInput {
  templateId: string;
  /** Map of `roleName` → person. Every template role must be assigned. */
  roleAssignments: Record<string, RoleAssignment>;
  /** Overrides the template's default subject. */
  subject?: string;
  message?: string;
}

/** Either an inline envelope or a template-based one. */
export type CreateEnvelopeInput = InlineEnvelopeInput | TemplateEnvelopeInput;

/** Options for listing envelopes. */
export interface ListEnvelopesParams {
  /** Opaque pagination cursor from a previous page's `next_cursor`. */
  cursor?: string;
  /** Page size. */
  limit?: number;
  status?: EnvelopeStatus;
  /** Filter by account mode; defaults to the API key's own mode. */
  mode?: Mode;
  /** ISO 8601 timestamp; only envelopes created at/after this time. */
  created_after?: string;
  /** ISO 8601 timestamp; only envelopes created at/before this time. */
  created_before?: string;
  /** Only envelopes that have a recipient with this exact email. */
  recipient_email?: string;
}

/** A template role definition. */
export interface TemplateRoleInput {
  roleName: string;
  /** Defaults to `1`. */
  routingOrder?: number;
  /** Defaults to `"SIGNER"`. */
  recipientType?: RecipientRole;
}

/**
 * A template field definition. Like {@link FieldInput} but references roles by
 * index instead of recipients.
 */
export interface TemplateFieldInput {
  /** Index into the `roles` array. */
  role: number;
  /** Index into the `documents` array. */
  document: number;
  type: FieldType;
  /** 1-indexed page. Defaults to `1`. */
  page?: number;
  anchor?: string;
  /** X position as a percentage (0–100). Defaults to `0`. */
  x?: number;
  /** Y position as a percentage (0–100). Defaults to `0`. */
  y?: number;
  /** Width as a percentage (0–100). Defaults to `30`. */
  width?: number;
  /** Height as a percentage (0–100). Defaults to `5`. */
  height?: number;
  /** Defaults to `true`. */
  required?: boolean;
  options?: string[];
}

/** Create a reusable template. */
export interface CreateTemplateInput {
  name: string;
  description?: string;
  documents: DocumentInput[];
  roles: TemplateRoleInput[];
  fields?: TemplateFieldInput[];
}

/** Patch a template's metadata. */
export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/** Public view of an API key (the secret itself is only returned at signup). */
export interface ApiKeyView {
  id: string;
  name: string;
  mode: "TEST" | "LIVE";
  /** Masked preview, e.g. `sk_test_…abcd`. */
  prefix?: string;
  scopes?: string[];
  createdAt?: string;
  [key: string]: unknown;
}

/** Result of {@link SwiftSign.signup}. */
export interface SignupResult {
  /** The full secret API key — store it now; it is never shown again. */
  api_key: string;
  mode: Mode;
  key: ApiKeyView;
  message?: string;
  verify_url?: string;
  docs_url?: string;
  [key: string]: unknown;
}

/** A document attached to an envelope. */
export interface EnvelopeDocument {
  id: string;
  name: string;
  pageCount: number;
  order: number;
  [key: string]: unknown;
}

/** A recipient on an envelope (as returned in an envelope object). */
export interface EnvelopeRecipient {
  id: string;
  name: string;
  email: string;
  role: RecipientRole;
  routingOrder: number;
  status: string;
  [key: string]: unknown;
}

/** A full envelope object, as returned by create / get. */
export interface Envelope {
  id: string;
  subject: string;
  message: string | null;
  status: EnvelopeStatus;
  livemode: boolean;
  createdAt: string;
  documents?: EnvelopeDocument[];
  recipients?: EnvelopeRecipient[];
  [key: string]: unknown;
}

/** A compact envelope row, as returned in list responses. */
export interface EnvelopeListItem {
  id: string;
  subject: string;
  status: EnvelopeStatus;
  livemode: boolean;
  createdAt: string;
  recipientCount: number;
}

/** A generic cursor-paginated response. */
export interface Page<T> {
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
}

/** Result of sending or voiding an envelope. */
export interface EnvelopeActionResult {
  status: "sent" | "voided";
  envelopeId: string;
}

/** Result of minting an embedded signing URL. */
export interface EmbeddedUrl {
  /** Single-use URL to drop into an iframe (valid ~30 minutes). */
  url: string;
  /** ISO 8601 expiry timestamp. */
  expiresAt: string;
}

/** Options for {@link Envelopes.createEmbeddedUrl}. */
export interface CreateEmbeddedUrlOptions {
  /** HTTPS URL the signer is redirected to after completing. */
  returnUrl?: string;
}

/** A compact template row, as returned in list responses. */
export interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
  roleCount: number;
  fieldCount: number;
  createdAt: string;
  updatedAt: string;
}

/** A full template object, as returned by create / get / update. */
export interface Template {
  id: string;
  name: string;
  description: string | null;
  documents?: unknown[];
  roles?: unknown[];
  fields?: unknown[];
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

/** Result of {@link Billing.upgradeUrl}. */
export type UpgradeResult =
  | { checkout_url: string; status?: undefined }
  | { status: "updated"; checkout_url?: undefined };

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Default API origin. */
export const DEFAULT_BASE_URL = "https://swiftsign.ca";

/** Options accepted by the {@link SwiftSign} constructor. */
export interface SwiftSignOptions {
  /** Override the API origin (no trailing slash needed). Defaults to {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
  /** Inject a custom `fetch` (e.g. for testing). Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

interface RequestOptions {
  method?: string;
  /** JSON-serializable body. */
  body?: unknown;
  /** Extra headers (e.g. `Idempotency-Key`). */
  headers?: Record<string, string>;
  /** Query parameters; `undefined`/`null` values are skipped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Set false to skip the Authorization header (used by signup). */
  auth?: boolean;
}

/**
 * SwiftSign API client.
 *
 * @example
 * ```ts
 * import { SwiftSign } from "swiftsign";
 *
 * const swiftsign = new SwiftSign(process.env.SWIFTSIGN_API_KEY!);
 * const envelope = await swiftsign.envelopes.create({
 *   subject: "Please sign",
 *   documents: [{ name: "contract.pdf", base64 }],
 *   recipients: [{ name: "Ada", email: "ada@example.com" }],
 *   fields: [{ recipientIndex: 0, document: 0, type: "SIGNATURE", anchor: "Sign here" }],
 * });
 * await swiftsign.envelopes.send(envelope.id);
 * ```
 */
export class SwiftSign {
  /** Resolved base URL, without a trailing slash. */
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  /** Envelope operations (create, list, get, send, void, embedded URLs). */
  readonly envelopes: Envelopes;
  /** Reusable template operations. */
  readonly templates: Templates;
  /** Billing / upgrade operations. */
  readonly billing: Billing;

  constructor(apiKey: string, options: SwiftSignOptions = {}) {
    if (!apiKey || typeof apiKey !== "string") {
      throw new Error("SwiftSign: an API key string is required.");
    }
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== "function") {
      throw new Error(
        "SwiftSign: global fetch is not available. Use Node 18+ or pass `fetch` in options."
      );
    }
    this.fetchImpl = f;

    this.envelopes = new Envelopes(this);
    this.templates = new Templates(this);
    this.billing = new Billing(this);
  }

  /**
   * Provision a new sandbox account and get a test API key in one
   * unauthenticated call. Returns `{ api_key, mode, key, ... }`. Store the
   * `api_key` — it is never shown again.
   *
   * Callable without an instance: `SwiftSign.signup({ email })`.
   */
  static async signup(
    input: { email: string; name?: string },
    options: SwiftSignOptions = {}
  ): Promise<SignupResult> {
    const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const f = options.fetch ?? globalThis.fetch;
    if (typeof f !== "function") {
      throw new Error(
        "SwiftSign: global fetch is not available. Use Node 18+ or pass `fetch` in options."
      );
    }
    const response = await f(`${baseUrl}/api/v1/signup`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw await errorFromResponse(response);
    }
    return (await response.json()) as SignupResult;
  }

  /**
   * Instance alias for {@link SwiftSign.signup}, for ergonomics. The current
   * instance's API key is not sent (signup is unauthenticated).
   */
  signup(input: { email: string; name?: string }): Promise<SignupResult> {
    return SwiftSign.signup(input, { baseUrl: this.baseUrl, fetch: this.fetchImpl });
  }

  /**
   * Low-level request helper used by the resource classes. Exposed for
   * advanced callers who need an endpoint the typed methods don't cover yet.
   */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      accept: "application/json",
      ...options.headers,
    };
    if (options.auth !== false) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
    }

    const response = await this.fetchImpl(url.toString(), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw await errorFromResponse(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

/** Envelope operations. Access via {@link SwiftSign.envelopes}. */
export class Envelopes {
  constructor(private readonly client: SwiftSign) {}

  /**
   * Create an envelope (inline or from a template). Sends an auto-generated
   * `Idempotency-Key`, so a retried call won't create a duplicate.
   */
  create(input: CreateEnvelopeInput): Promise<Envelope> {
    return this.client.request<Envelope>("/api/v1/envelopes", {
      method: "POST",
      body: input,
      headers: { "idempotency-key": randomUUID() },
    });
  }

  /** List envelopes with cursor pagination and optional filters. */
  list(params: ListEnvelopesParams = {}): Promise<Page<EnvelopeListItem>> {
    return this.client.request<Page<EnvelopeListItem>>("/api/v1/envelopes", {
      query: { ...params },
    });
  }

  /** Retrieve a single envelope, including documents, recipients, and audit log. */
  get(id: string): Promise<Envelope> {
    return this.client.request<Envelope>(`/api/v1/envelopes/${encodeURIComponent(id)}`);
  }

  /** Send a DRAFT envelope to its first routing-order signers. */
  send(id: string): Promise<EnvelopeActionResult> {
    return this.client.request<EnvelopeActionResult>(
      `/api/v1/envelopes/${encodeURIComponent(id)}`,
      { method: "POST", body: { action: "send" } }
    );
  }

  /** Void an envelope that is not yet completed. */
  void(id: string): Promise<EnvelopeActionResult> {
    return this.client.request<EnvelopeActionResult>(
      `/api/v1/envelopes/${encodeURIComponent(id)}`,
      { method: "POST", body: { action: "void" } }
    );
  }

  /**
   * Mint a single-use embedded signing URL for a recipient on a SENT envelope.
   * Drop the returned `url` into an iframe, or use the {@link embed} helper.
   */
  createEmbeddedUrl(
    envelopeId: string,
    recipientId: string,
    options: CreateEmbeddedUrlOptions = {}
  ): Promise<EmbeddedUrl> {
    return this.client.request<EmbeddedUrl>(
      `/api/v1/envelopes/${encodeURIComponent(envelopeId)}/recipients/${encodeURIComponent(
        recipientId
      )}/embedded-url`,
      { method: "POST", body: options.returnUrl ? { returnUrl: options.returnUrl } : {} }
    );
  }
}

/** Reusable template operations. Access via {@link SwiftSign.templates}. */
export class Templates {
  constructor(private readonly client: SwiftSign) {}

  /** Create a reusable template (documents are uploaded and rendered once). */
  create(input: CreateTemplateInput): Promise<Template> {
    return this.client.request<Template>("/api/v1/templates", {
      method: "POST",
      body: input,
    });
  }

  /** List templates with cursor pagination. */
  list(params: { cursor?: string; limit?: number } = {}): Promise<Page<TemplateListItem>> {
    return this.client.request<Page<TemplateListItem>>("/api/v1/templates", {
      query: { ...params },
    });
  }

  /** Retrieve a single template, including its documents, roles, and fields. */
  get(id: string): Promise<Template> {
    return this.client.request<Template>(`/api/v1/templates/${encodeURIComponent(id)}`);
  }

  /** Update a template's name and/or description. */
  update(id: string, input: UpdateTemplateInput): Promise<Template> {
    return this.client.request<Template>(`/api/v1/templates/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: input,
    });
  }

  /** Delete a template (cascades to its documents, roles, and fields). */
  delete(id: string): Promise<void> {
    return this.client.request<void>(`/api/v1/templates/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
}

/** Billing operations. Access via {@link SwiftSign.billing}. */
export class Billing {
  constructor(private readonly client: SwiftSign) {}

  /**
   * Start an upgrade. Returns `{ checkout_url }` to redirect to Stripe, or
   * `{ status: "updated" }` if the change applied without checkout.
   */
  upgradeUrl(params: { plan?: Plan } = {}): Promise<UpgradeResult> {
    return this.client.request<UpgradeResult>("/api/v1/billing/upgrade", {
      method: "POST",
      body: params.plan ? { plan: params.plan } : {},
    });
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** UUID v4 with a fallback for runtimes lacking `crypto.randomUUID`. */
function randomUUID(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  // RFC 4122 v4 fallback.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
