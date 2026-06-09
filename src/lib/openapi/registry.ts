import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

// STANDALONE OpenAPI registry. Deliberately re-declares the request/response
// shapes rather than importing the route files — so this module has zero
// runtime coupling to the API routes (no Prisma / env / R2 imports pulled in
// at build time). Some duplication with src/app/api/v1/* is intentional.

extendZodWithOpenApi(z)

const registry = new OpenAPIRegistry()

// ---------- Security scheme ----------

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description:
    'API key as a Bearer token. Use a sk_test_… key for the sandbox (free, watermarked) ' +
    'or a sk_live_… key for production sends. Get one from POST /api/v1/signup.',
})

const SECURITY = [{ [bearerAuth.name]: [] as string[] }]

// ---------- Field types ----------

const FIELD_TYPES = [
  'SIGNATURE',
  'NAME',
  'DATE',
  'TEXT',
  'INITIALS',
  'CHECKBOX',
  'RADIO',
  'DROPDOWN',
  'ATTACHMENT',
] as const

const FieldType = z
  .enum(FIELD_TYPES)
  .openapi('FieldType', { description: 'Signature/data field type to place on a document.' })

const EnvelopeStatus = z
  .enum(['DRAFT', 'SENT', 'COMPLETED', 'DECLINED', 'VOIDED'])
  .openapi('EnvelopeStatus')

// ---------- Problem (RFC 9457) ----------

const Problem = registry.register(
  'Problem',
  z
    .object({
      type: z
        .string()
        .openapi({ example: 'https://swiftsign.ca/errors/validation_error' }),
      title: z.string().openapi({ example: 'Request validation failed' }),
      status: z.number().int().openapi({ example: 400 }),
      code: z.string().openapi({ example: 'validation_error' }),
      detail: z.string().optional().openapi({ example: 'A valid email is required' }),
      request_id: z.string().openapi({ example: 'req_8c2f9a1b3d4e5f6071829304' }),
    })
    .openapi('Problem', {
      description:
        'RFC 9457 problem document, served as application/problem+json. Endpoints may add ' +
        'extra top-level members (e.g. errors[], unresolvedAnchors[], plan/used/limit).',
    })
)

// Reusable application/problem+json response builder.
function problemResponse(description: string) {
  return {
    description,
    content: { 'application/problem+json': { schema: Problem } },
  }
}

// ---------- Shared sub-schemas ----------

const DocumentInput = z
  .object({
    name: z.string().min(1).openapi({ example: 'mutual-nda.pdf' }),
    base64: z
      .string()
      .min(1)
      .openapi({ description: 'Base64-encoded PDF bytes.', example: 'JVBERi0xLjcKJ…' }),
  })
  .openapi('DocumentInput')

const RecipientInput = z
  .object({
    name: z.string().min(1).openapi({ example: 'Steve Park' }),
    email: z.string().email().openapi({ example: 'steve@acme.com' }),
    role: z.enum(['SIGNER', 'CC']).default('SIGNER').openapi({ example: 'SIGNER' }),
    routingOrder: z
      .number()
      .int()
      .min(1)
      .default(1)
      .openapi({ description: 'Signing order; lower routes first.', example: 1 }),
  })
  .openapi('RecipientInput')

const FieldInput = z
  .object({
    recipientIndex: z
      .number()
      .int()
      .min(0)
      .openapi({ description: 'Index into the recipients[] array.', example: 0 }),
    document: z
      .number()
      .int()
      .min(0)
      .openapi({ description: 'Index into the documents[] array.', example: 0 }),
    type: FieldType,
    page: z
      .number()
      .int()
      .min(-1)
      .default(1)
      .openapi({ description: '1-indexed page. Ignored when anchor resolves.', example: 1 }),
    x: z
      .number()
      .min(0)
      .max(100)
      .default(0)
      .openapi({ description: 'X as a percent (0–100) of page width, top-left origin.', example: 12 }),
    y: z
      .number()
      .min(0)
      .max(100)
      .default(0)
      .openapi({ description: 'Y as a percent (0–100) of page height, top-left origin.', example: 64 }),
    width: z.number().min(0).max(100).optional().openapi({ example: 30 }),
    height: z.number().min(0).max(100).optional().openapi({ example: 5 }),
    anchor: z
      .string()
      .optional()
      .openapi({ description: 'Anchor text to place the field next to.', example: 'Party B — Signature' }),
    yOffset: z
      .number()
      .optional()
      .openapi({ description: 'Vertical nudge (percent) applied to an anchor match.', example: -2 }),
    options: z
      .array(z.string())
      .optional()
      .openapi({ description: 'Choices for RADIO / DROPDOWN fields.', example: ['Yes', 'No'] }),
  })
  .openapi('FieldInput')

const RoleAssignment = z
  .object({
    name: z.string().min(1).openapi({ example: 'Steve Park' }),
    email: z.string().email().openapi({ example: 'steve@acme.com' }),
  })
  .openapi('RoleAssignment')

// ---------- Envelope request bodies ----------

const InlineEnvelopeBody = z
  .object({
    subject: z.string().min(1).openapi({ example: 'Mutual NDA for countersignature' }),
    message: z.string().optional().openapi({ example: 'Please sign at your convenience.' }),
    documents: z.array(DocumentInput).min(1),
    recipients: z.array(RecipientInput).min(1),
    fields: z.array(FieldInput).default([]),
  })
  .openapi('InlineEnvelopeBody', {
    description: 'Create an envelope from inline base64 documents, recipients, and fields.',
  })

const TemplateEnvelopeBody = z
  .object({
    templateId: z.string().min(1).openapi({ example: 'tmpl_3f8a9c21' }),
    roleAssignments: z
      .record(z.string(), RoleAssignment)
      .openapi({ description: 'Map of template roleName → { name, email }.' }),
    subject: z.string().min(1).optional(),
    message: z.string().optional(),
  })
  .openapi('TemplateEnvelopeBody', {
    description: 'Create an envelope from a saved template by assigning each role.',
  })

const CreateEnvelopeBody = z
  .union([InlineEnvelopeBody, TemplateEnvelopeBody])
  .openapi('CreateEnvelopeBody')

// ---------- Envelope response shapes ----------

const RecipientView = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    role: z.enum(['SIGNER', 'CC']),
    routingOrder: z.number().int(),
    status: z.string().openapi({ example: 'PENDING' }),
  })
  .openapi('Recipient')

const DocumentView = z
  .object({
    id: z.string(),
    name: z.string(),
    pageCount: z.number().int(),
    order: z.number().int(),
  })
  .openapi('Document')

const Envelope = z
  .object({
    id: z.string().openapi({ example: 'b8f1c0a2-3d4e-5f60-7182-93041a2b3c4d' }),
    subject: z.string(),
    message: z.string().nullable(),
    status: EnvelopeStatus,
    livemode: z.boolean(),
    createdAt: z.string().openapi({ example: '2026-03-14T16:02:11.000Z' }),
    documents: z.array(DocumentView),
    recipients: z.array(RecipientView),
  })
  .openapi('Envelope')

const EnvelopeListItem = z
  .object({
    id: z.string(),
    subject: z.string(),
    status: EnvelopeStatus,
    livemode: z.boolean(),
    createdAt: z.string(),
    recipientCount: z.number().int(),
  })
  .openapi('EnvelopeListItem')

const EnvelopeList = z
  .object({
    data: z.array(EnvelopeListItem),
    has_more: z.boolean(),
    next_cursor: z.string().nullable(),
  })
  .openapi('EnvelopeList')

const ActionBody = z
  .object({
    action: z.enum(['send', 'void']).openapi({ example: 'send' }),
  })
  .openapi('EnvelopeActionBody')

const ActionResult = z
  .object({
    status: z.enum(['sent', 'voided']),
    envelopeId: z.string(),
  })
  .openapi('EnvelopeActionResult')

const EmbeddedUrlBody = z
  .object({
    returnUrl: z
      .string()
      .url()
      .optional()
      .openapi({ description: 'https URL to return the signer to after signing.', example: 'https://acme.com/signed' }),
  })
  .openapi('EmbeddedUrlBody')

const EmbeddedUrl = z
  .object({
    url: z.string().url().openapi({ example: 'https://swiftsign.ca/embed/abc123…' }),
    expiresAt: z.string().openapi({ example: '2026-03-14T16:32:11.000Z' }),
  })
  .openapi('EmbeddedUrl')

// ---------- Signup / billing ----------

const SignupBody = z
  .object({
    email: z.string().email().openapi({ example: 'dev@acme.com' }),
    name: z.string().optional().openapi({ example: 'Acme Dev' }),
  })
  .openapi('SignupBody')

const ApiKeyView = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    mode: z.enum(['TEST', 'LIVE']),
    prefix: z.string().openapi({ example: 'sk_test_a1b2c3d4' }),
    last4: z.string().openapi({ example: 'ef90' }),
    scopes: z.array(z.string()).openapi({ example: ['envelopes:read', 'envelopes:write'] }),
    createdAt: z.string(),
  })
  .openapi('ApiKeyView')

const SignupResult = z
  .object({
    api_key: z
      .string()
      .openapi({ description: 'The plaintext secret — shown once, never again.', example: 'sk_test_…' }),
    mode: z.enum(['test', 'live']).openapi({ example: 'test' }),
    key: ApiKeyView,
    message: z.string(),
    verify_url: z.string().url(),
    docs_url: z.string().url(),
  })
  .openapi('SignupResult')

const UpgradeBody = z
  .object({
    plan: z.enum(['PRO', 'TEAM']).default('PRO').openapi({ example: 'PRO' }),
  })
  .openapi('UpgradeBody')

const UpgradeResult = z
  .union([
    z.object({ checkout_url: z.string().url().openapi({ example: 'https://checkout.stripe.com/…' }) }),
    z.object({ status: z.literal('updated') }),
  ])
  .openapi('UpgradeResult')

// ---------- Template request/response ----------

const TemplateRoleInput = z
  .object({
    roleName: z.string().min(1).openapi({ example: 'Client' }),
    routingOrder: z.number().int().min(1).default(1),
    recipientType: z.enum(['SIGNER', 'CC']).default('SIGNER'),
  })
  .openapi('TemplateRoleInput')

const TemplateFieldInput = z
  .object({
    role: z.number().int().min(0).openapi({ description: 'Index into roles[].' }),
    document: z.number().int().min(0).openapi({ description: 'Index into documents[].' }),
    type: FieldType,
    page: z.number().int().min(1).default(1),
    anchor: z.string().optional(),
    x: z.number().min(0).max(100).default(0),
    y: z.number().min(0).max(100).default(0),
    width: z.number().min(0).max(100).optional(),
    height: z.number().min(0).max(100).optional(),
    required: z.boolean().default(true),
    options: z.array(z.string()).optional(),
  })
  .openapi('TemplateFieldInput')

const CreateTemplateBody = z
  .object({
    name: z.string().min(1).openapi({ example: 'Standard MSA' }),
    description: z.string().optional(),
    documents: z.array(DocumentInput).min(1),
    roles: z.array(TemplateRoleInput).min(1),
    fields: z.array(TemplateFieldInput).default([]),
  })
  .openapi('CreateTemplateBody')

const UpdateTemplateBody = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
  })
  .openapi('UpdateTemplateBody')

const Template = z
  .object({
    id: z.string().openapi({ example: 'tmpl_3f8a9c21' }),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Template')

const TemplateListItem = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    documentCount: z.number().int(),
    roleCount: z.number().int(),
    fieldCount: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('TemplateListItem')

const TemplateList = z
  .object({
    data: z.array(TemplateListItem),
    has_more: z.boolean(),
    next_cursor: z.string().nullable(),
  })
  .openapi('TemplateList')

// ---------- Shared parameters ----------

const IdempotencyKeyHeader = z.object({
  'Idempotency-Key': z
    .string()
    .optional()
    .openapi({
      param: { name: 'Idempotency-Key', in: 'header' },
      description: 'Optional. Replays the original response for a duplicate request body.',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
    }),
})

// =====================================================================
// Paths
// =====================================================================

// ---- POST /api/v1/signup (no auth) ----
registry.registerPath({
  method: 'post',
  path: '/api/v1/signup',
  tags: ['Auth'],
  summary: 'Provision a sandbox account + sk_test_ key',
  description:
    'Unauthenticated. One call creates an account and returns a TEST key so an agent or ' +
    'curl is productive immediately. No browser required.',
  security: [],
  request: {
    body: { content: { 'application/json': { schema: SignupBody } } },
  },
  responses: {
    201: {
      description: 'Account created.',
      content: { 'application/json': { schema: SignupResult } },
    },
    409: problemResponse('An account with this email already exists.'),
    429: problemResponse('Too many signups from this IP.'),
  },
})

// ---- POST /api/v1/billing/upgrade ----
registry.registerPath({
  method: 'post',
  path: '/api/v1/billing/upgrade',
  tags: ['Billing'],
  summary: 'Start an upgrade to a paid plan',
  security: SECURITY,
  request: {
    body: { content: { 'application/json': { schema: UpgradeBody } } },
  },
  responses: {
    200: {
      description: 'A Stripe Checkout URL, or { status: "updated" } if no payment is needed.',
      content: { 'application/json': { schema: UpgradeResult } },
    },
    401: problemResponse('Missing or invalid API key.'),
    503: problemResponse('Billing is not currently available.'),
  },
})

// ---- POST /api/v1/envelopes ----
registry.registerPath({
  method: 'post',
  path: '/api/v1/envelopes',
  tags: ['Envelopes'],
  summary: 'Create an envelope (inline or from a template)',
  security: SECURITY,
  request: {
    headers: IdempotencyKeyHeader,
    body: { content: { 'application/json': { schema: CreateEnvelopeBody } } },
  },
  responses: {
    201: {
      description: 'Envelope created (DRAFT). Call POST /api/v1/envelopes/{id} with action:"send".',
      content: { 'application/json': { schema: Envelope } },
    },
    400: problemResponse('Validation error.'),
    401: problemResponse('Missing or invalid API key.'),
    402: problemResponse('Monthly envelope quota exceeded.'),
    403: problemResponse('API key lacks the envelopes:write scope.'),
    422: problemResponse('One or more field anchors could not be resolved.'),
    429: problemResponse('Rate limited.'),
  },
})

// ---- GET /api/v1/envelopes ----
registry.registerPath({
  method: 'get',
  path: '/api/v1/envelopes',
  tags: ['Envelopes'],
  summary: 'List envelopes (cursor pagination)',
  security: SECURITY,
  request: {
    query: z.object({
      cursor: z.string().optional().openapi({ description: 'Opaque cursor from next_cursor.' }),
      limit: z.number().int().min(1).max(100).optional().openapi({ description: 'Default 25, max 100.', example: 25 }),
      status: EnvelopeStatus.optional(),
      mode: z.enum(['live', 'test']).optional().openapi({ description: 'Defaults to the key’s mode.' }),
      created_after: z.string().optional().openapi({ description: 'ISO 8601 lower bound.' }),
      created_before: z.string().optional().openapi({ description: 'ISO 8601 upper bound.' }),
      recipient_email: z.string().email().optional(),
    }),
  },
  responses: {
    200: {
      description: 'A page of envelopes.',
      content: { 'application/json': { schema: EnvelopeList } },
    },
    401: problemResponse('Missing or invalid API key.'),
    403: problemResponse('API key lacks the envelopes:read scope.'),
  },
})

// ---- GET /api/v1/envelopes/{id} ----
registry.registerPath({
  method: 'get',
  path: '/api/v1/envelopes/{id}',
  tags: ['Envelopes'],
  summary: 'Retrieve an envelope',
  security: SECURITY,
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
  },
  responses: {
    200: {
      description: 'The envelope, including recipients, documents, and audit log.',
      content: { 'application/json': { schema: Envelope } },
    },
    401: problemResponse('Missing or invalid API key.'),
    404: problemResponse('Envelope not found.'),
  },
})

// ---- POST /api/v1/envelopes/{id} (send | void) ----
registry.registerPath({
  method: 'post',
  path: '/api/v1/envelopes/{id}',
  tags: ['Envelopes'],
  summary: 'Send or void an envelope',
  security: SECURITY,
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: { content: { 'application/json': { schema: ActionBody } } },
  },
  responses: {
    200: {
      description: 'Action applied.',
      content: { 'application/json': { schema: ActionResult } },
    },
    400: problemResponse('Invalid action.'),
    401: problemResponse('Missing or invalid API key.'),
    404: problemResponse('Envelope not found.'),
    409: problemResponse('Envelope is not in a valid state for this action.'),
  },
})

// ---- POST .../recipients/{recipientId}/embedded-url ----
registry.registerPath({
  method: 'post',
  path: '/api/v1/envelopes/{id}/recipients/{recipientId}/embedded-url',
  tags: ['Envelopes'],
  summary: 'Mint a short-lived embedded signing URL',
  security: SECURITY,
  request: {
    params: z.object({
      id: z.string().openapi({ param: { name: 'id', in: 'path' } }),
      recipientId: z.string().openapi({ param: { name: 'recipientId', in: 'path' } }),
    }),
    body: { content: { 'application/json': { schema: EmbeddedUrlBody } } },
  },
  responses: {
    200: {
      description: 'A single-use iframe URL valid for 30 minutes.',
      content: { 'application/json': { schema: EmbeddedUrl } },
    },
    400: problemResponse('returnUrl must be a valid https URL.'),
    401: problemResponse('Missing or invalid API key.'),
    404: problemResponse('Envelope or recipient not found.'),
    409: problemResponse('Recipient cannot be embedded in the current state.'),
  },
})

// ---- POST /api/v1/templates ----
registry.registerPath({
  method: 'post',
  path: '/api/v1/templates',
  tags: ['Templates'],
  summary: 'Create a reusable template',
  security: SECURITY,
  request: {
    body: { content: { 'application/json': { schema: CreateTemplateBody } } },
  },
  responses: {
    201: {
      description: 'Template created.',
      content: { 'application/json': { schema: Template } },
    },
    400: problemResponse('Validation error.'),
    401: problemResponse('Missing or invalid API key.'),
    403: problemResponse('API key lacks the envelopes:write scope.'),
  },
})

// ---- GET /api/v1/templates ----
registry.registerPath({
  method: 'get',
  path: '/api/v1/templates',
  tags: ['Templates'],
  summary: 'List templates (cursor pagination)',
  security: SECURITY,
  request: {
    query: z.object({
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional().openapi({ description: 'Default 25, max 100.' }),
    }),
  },
  responses: {
    200: {
      description: 'A page of templates.',
      content: { 'application/json': { schema: TemplateList } },
    },
    401: problemResponse('Missing or invalid API key.'),
  },
})

// ---- GET /api/v1/templates/{id} ----
registry.registerPath({
  method: 'get',
  path: '/api/v1/templates/{id}',
  tags: ['Templates'],
  summary: 'Retrieve a template',
  security: SECURITY,
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
  },
  responses: {
    200: {
      description: 'The template, including documents, roles, and fields.',
      content: { 'application/json': { schema: Template } },
    },
    401: problemResponse('Missing or invalid API key.'),
    404: problemResponse('Template not found.'),
  },
})

// ---- PATCH /api/v1/templates/{id} ----
registry.registerPath({
  method: 'patch',
  path: '/api/v1/templates/{id}',
  tags: ['Templates'],
  summary: 'Update a template’s name or description',
  security: SECURITY,
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
    body: { content: { 'application/json': { schema: UpdateTemplateBody } } },
  },
  responses: {
    200: {
      description: 'The updated template.',
      content: { 'application/json': { schema: Template } },
    },
    400: problemResponse('Validation error.'),
    401: problemResponse('Missing or invalid API key.'),
    404: problemResponse('Template not found.'),
  },
})

// ---- DELETE /api/v1/templates/{id} ----
registry.registerPath({
  method: 'delete',
  path: '/api/v1/templates/{id}',
  tags: ['Templates'],
  summary: 'Delete a template',
  security: SECURITY,
  request: {
    params: z.object({ id: z.string().openapi({ param: { name: 'id', in: 'path' } }) }),
  },
  responses: {
    204: { description: 'Deleted.' },
    401: problemResponse('Missing or invalid API key.'),
    404: problemResponse('Template not found.'),
  },
})

// =====================================================================
// Webhooks (OpenAPI 3.1 top-level `webhooks`)
// =====================================================================

// Outbound event envelope. Body is signed: `SwiftSign-Signature: t=<unix>,v1=<hex>`
// where v1 = HMAC-SHA256(secret, `${t}.${rawBody}`). Verify on the raw bytes
// before parsing. Delivery retries up to 6 times (1m/5m/30m/2h/12h/24h backoff);
// any 2xx acknowledges.
const WebhookEventEnvelope = registry.register(
  'WebhookEvent',
  z
    .object({
      id: z.string().openapi({ example: 'evt_8c2f9a1b3d4e5f6071829304' }),
      type: z
        .enum([
          'envelope.sent',
          'envelope.viewed',
          'envelope.signed',
          'envelope.completed',
          'envelope.declined',
          'envelope.voided',
        ])
        .openapi({ example: 'envelope.completed' }),
      createdAt: z.string().datetime().openapi({ example: '2026-06-09T17:00:00.000Z' }),
      data: z
        .record(z.string(), z.unknown())
        .openapi({ description: 'Event payload; always includes envelopeId.' }),
    })
    .openapi('WebhookEvent', {
      description:
        'Envelope for every webhook delivery. Signed with the SwiftSign-Signature header ' +
        '(t=<unix>,v1=<HMAC-SHA256 hex over `${t}.${rawBody}`>). Respond 2xx to acknowledge.',
    })
)

const WEBHOOK_EVENTS: Array<{ name: string; when: string }> = [
  { name: 'envelope.sent', when: 'An envelope was dispatched to its first signer batch.' },
  { name: 'envelope.viewed', when: 'A signer opened their signing link.' },
  { name: 'envelope.signed', when: 'A signer completed their fields (more signers may remain).' },
  { name: 'envelope.completed', when: 'Every signer finished; sealed PDFs + Certificate are ready to download.' },
  { name: 'envelope.declined', when: 'A signer declined to sign.' },
  { name: 'envelope.voided', when: 'The sender voided the envelope.' },
]

for (const evt of WEBHOOK_EVENTS) {
  registry.registerWebhook({
    method: 'post',
    path: evt.name,
    summary: evt.when,
    description:
      `Sent to your subscribed endpoint when ${evt.when.charAt(0).toLowerCase()}${evt.when.slice(1)} ` +
      'Verify the SwiftSign-Signature header before trusting the body.',
    request: {
      body: { content: { 'application/json': { schema: WebhookEventEnvelope } } },
    },
    responses: {
      200: { description: 'Acknowledged. Any 2xx stops retries.' },
    },
  })
}

// =====================================================================
// Generate
// =====================================================================

export function getOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions)
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'SwiftSign API',
      version: '1.0.0',
      description:
        'Agent-native e-signature API. Sign up with one unauthenticated call, get a sandbox ' +
        'key, and send a sealed envelope in minutes. All endpoints except signup require a ' +
        'Bearer API key. Errors are RFC 9457 problem documents (application/problem+json).',
    },
    servers: [{ url: 'https://swiftsign.ca' }],
  })
}
