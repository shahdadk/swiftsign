import { NextResponse } from 'next/server'
import crypto from 'crypto'
import type { ZodError } from 'zod'

// RFC 9457 (application/problem+json) error responses for the public API.
// One helper, applied uniformly across /api/v1, /api/billing, /api/sign so
// callers (especially agents/SDKs) get a stable, machine-readable shape:
//   { type, title, status, code, detail?, request_id, ...extensions }

export type ProblemCode =
  | 'unauthorized'
  | 'forbidden'
  | 'validation_error'
  | 'not_found'
  | 'envelope_not_found'
  | 'template_not_found'
  | 'envelope_quota_exceeded'
  | 'invalid_state'
  | 'anchor_unresolved'
  | 'pdf_render_failed'
  | 'payload_too_large'
  | 'rate_limited'
  | 'idempotency_conflict'
  | 'idempotency_key_reused'
  | 'billing_unavailable'
  | 'team_contact_sales'
  | 'test_mode_unsupported'
  | 'method_not_allowed'
  | 'conflict'
  | 'internal_error'

const STATUS: Record<ProblemCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  validation_error: 400,
  not_found: 404,
  envelope_not_found: 404,
  template_not_found: 404,
  envelope_quota_exceeded: 402,
  invalid_state: 409,
  anchor_unresolved: 422,
  pdf_render_failed: 422,
  payload_too_large: 413,
  rate_limited: 429,
  idempotency_conflict: 409,
  idempotency_key_reused: 422,
  billing_unavailable: 503,
  team_contact_sales: 409,
  test_mode_unsupported: 400,
  method_not_allowed: 405,
  conflict: 409,
  internal_error: 500,
}

const TITLE: Record<ProblemCode, string> = {
  unauthorized: 'Authentication required',
  forbidden: 'Insufficient permissions',
  validation_error: 'Request validation failed',
  not_found: 'Resource not found',
  envelope_not_found: 'Envelope not found',
  template_not_found: 'Template not found',
  envelope_quota_exceeded: 'Monthly envelope quota exceeded',
  invalid_state: 'Resource is not in a valid state for this action',
  anchor_unresolved: 'One or more field anchors could not be resolved',
  pdf_render_failed: 'A document could not be rendered',
  payload_too_large: 'Request payload too large',
  rate_limited: 'Too many requests',
  idempotency_conflict: 'A request with this Idempotency-Key is still being processed',
  idempotency_key_reused: 'Idempotency-Key reused with a different request body',
  billing_unavailable: 'Billing is not currently available',
  team_contact_sales: 'The Team plan is not self-serve; contact sales',
  test_mode_unsupported: 'This action is not supported in test mode',
  method_not_allowed: 'Method not allowed',
  conflict: 'Conflict',
  internal_error: 'Internal server error',
}

export interface ProblemOptions {
  status?: number
  detail?: string
  headers?: HeadersInit
  requestId?: string
  // Any additional members become top-level problem extensions.
  [ext: string]: unknown
}

export function newRequestId(): string {
  return `req_${crypto.randomBytes(12).toString('hex')}`
}

export function problem(code: ProblemCode, options: ProblemOptions = {}): NextResponse {
  const { status, detail, headers, requestId, ...ext } = options
  const id = requestId ?? newRequestId()
  const body: Record<string, unknown> = {
    type: `https://swiftsign.ca/errors/${code}`,
    title: TITLE[code],
    status: status ?? STATUS[code],
    code,
    ...(detail ? { detail } : {}),
    request_id: id,
    ...ext,
  }
  const h = new Headers(headers)
  h.set('content-type', 'application/problem+json')
  h.set('x-request-id', id)
  return NextResponse.json(body, { status: body.status as number, headers: h })
}

export function zodProblem(error: ZodError, options: ProblemOptions = {}): NextResponse {
  const errors = error.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
  }))
  return problem('validation_error', { ...options, errors })
}
