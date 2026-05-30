/**
 * An RFC 9457 (application/problem+json) error body, as returned by the
 * SwiftSign API for most failures.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9457
 */
export interface SwiftSignProblem {
  /** A URI reference identifying the problem type, e.g. `https://swiftsign.ca/errors/unauthorized`. */
  type?: string;
  /** A short, human-readable summary of the problem type. */
  title?: string;
  /** The HTTP status code. */
  status?: number;
  /** A stable, machine-readable error code, e.g. `validation_error`. */
  code?: string;
  /** A human-readable explanation specific to this occurrence. */
  detail?: string;
  /** Correlation id for support; echoes the `x-request-id` response header. */
  request_id?: string;
  /** Any additional problem-specific extension members (e.g. `errors`, `fieldErrors`). */
  [ext: string]: unknown;
}

/**
 * Thrown for every non-2xx response from the SwiftSign API.
 *
 * Inspect {@link SwiftSignError.code} for branching (it's stable across versions),
 * {@link SwiftSignError.status} for the HTTP status, and
 * {@link SwiftSignError.requestId} when contacting support.
 *
 * @example
 * ```ts
 * try {
 *   await swiftsign.envelopes.get("env_missing");
 * } catch (err) {
 *   if (err instanceof SwiftSignError && err.code === "envelope_not_found") {
 *     // handle 404
 *   }
 * }
 * ```
 */
export class SwiftSignError extends Error {
  /** Stable, machine-readable error code (e.g. `unauthorized`, `validation_error`). */
  readonly code: string;
  /** HTTP status code of the failed response. */
  readonly status: number;
  /** Request correlation id (from the problem body or `x-request-id` header), if any. */
  readonly requestId?: string;
  /** Human-readable, occurrence-specific detail, if the API provided one. */
  readonly detail?: string;
  /** The raw parsed problem body (or a synthesized one for non-JSON errors). */
  readonly problem: SwiftSignProblem;

  constructor(args: {
    message: string;
    code: string;
    status: number;
    requestId?: string;
    detail?: string;
    problem: SwiftSignProblem;
  }) {
    super(args.message);
    this.name = "SwiftSignError";
    this.code = args.code;
    this.status = args.status;
    this.requestId = args.requestId;
    this.detail = args.detail;
    this.problem = args.problem;
    // Restore the prototype chain when compiled to ES5-ish targets.
    Object.setPrototypeOf(this, SwiftSignError.prototype);
  }
}

/**
 * Build a {@link SwiftSignError} from a failed `Response`. Handles three body
 * shapes the API can return: RFC 9457 problem+json, the legacy `{ error }`
 * shape (still used by a few endpoints), and non-JSON bodies.
 *
 * @internal
 */
export async function errorFromResponse(response: Response): Promise<SwiftSignError> {
  const headerRequestId = response.headers.get("x-request-id") ?? undefined;
  const status = response.status;

  let raw: unknown;
  let text = "";
  try {
    text = await response.text();
    raw = text ? JSON.parse(text) : undefined;
  } catch {
    raw = undefined;
  }

  if (raw && typeof raw === "object") {
    const body = raw as Record<string, unknown>;

    // RFC 9457 problem+json.
    if (typeof body.code === "string" || typeof body.type === "string") {
      const problem = body as SwiftSignProblem;
      const code = problem.code ?? codeFromStatus(status);
      const detail = problem.detail;
      const message =
        detail ?? problem.title ?? `SwiftSign request failed with status ${status}`;
      return new SwiftSignError({
        message,
        code,
        status,
        requestId: problem.request_id ?? headerRequestId,
        detail,
        problem,
      });
    }

    // Legacy `{ error: "..." }` shape (envelope actions, embedded-url, billing).
    if (typeof body.error === "string") {
      const message = body.error;
      return new SwiftSignError({
        message,
        code: codeFromStatus(status),
        status,
        requestId: headerRequestId,
        detail: message,
        problem: { status, code: codeFromStatus(status), detail: message, ...body },
      });
    }
  }

  // Non-JSON or unrecognized body.
  const message = text.trim() || `SwiftSign request failed with status ${status}`;
  return new SwiftSignError({
    message,
    code: codeFromStatus(status),
    status,
    requestId: headerRequestId,
    detail: text.trim() || undefined,
    problem: { status, code: codeFromStatus(status) },
  });
}

/** Best-effort fallback code when the body doesn't carry one. */
function codeFromStatus(status: number): string {
  switch (status) {
    case 400:
      return "validation_error";
    case 401:
      return "unauthorized";
    case 402:
      return "payment_required";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 413:
      return "payload_too_large";
    case 422:
      return "unprocessable_entity";
    case 429:
      return "rate_limited";
    case 503:
      return "service_unavailable";
    default:
      return status >= 500 ? "internal_error" : "request_failed";
  }
}
