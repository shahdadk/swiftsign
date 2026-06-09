import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { writeFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";

// Transport-agnostic SwiftSign tool registrations, shared by the stdio binary
// (mcp/src/index.ts) and the hosted Streamable-HTTP endpoint (swiftsign.ca/mcp).
// The two transports differ only in how a key is resolved and what the runtime
// allows, captured in ToolContext.

export interface ToolContext {
  apiUrl: string;
  // stdio: () => process.env.SWIFTSIGN_API_KEY; remote: (extra) => extra.authInfo.token
  resolveKey: (extra?: { authInfo?: { token?: string } }) => string | undefined;
  // Vercel filesystem is read-only; remote returns base64 instead of writing files.
  allowFileWrites: boolean;
  // Remote requires auth before any tool call, so signup only exists on stdio.
  allowSignup: boolean;
  // Funnel attribution recorded by swiftsign_signup ("mcp", "site", "registry", ...).
  defaultSource?: string;
}

// SwiftSign returns RFC 9457 application/problem+json on errors. Surface the
// stable `code` + title + detail so an agent can self-correct (anchor_unresolved
// -> fix the anchor; envelope_quota_exceeded -> upgrade; invalid_state -> wrong
// envelope status) instead of seeing an opaque "API error 500".
export function formatApiError(status: number, text: string): string {
  try {
    const p = JSON.parse(text) as {
      code?: string;
      title?: string;
      detail?: string;
      request_id?: string;
      errors?: { path?: string; message?: string }[];
    };
    if (p && (p.code || p.title)) {
      let msg = `SwiftSign error [${p.code ?? status}]${p.title ? ` ${p.title}` : ""}`;
      if (p.detail) msg += `: ${p.detail}`;
      if (Array.isArray(p.errors) && p.errors.length) {
        msg +=
          " — " +
          p.errors
            .map((e) => `${e.path ? `${e.path}: ` : ""}${e.message ?? ""}`)
            .join("; ");
      }
      if (p.request_id) msg += ` (request_id ${p.request_id})`;
      return msg;
    }
  } catch {
    // not JSON — fall through to the raw text
  }
  return `SwiftSign API error ${status}: ${text.slice(0, 500)}`;
}

const NO_KEY_MSG =
  "No SwiftSign API key available. Run swiftsign_signup to mint a sandbox key (sk_test_…), then set SWIFTSIGN_API_KEY.";

async function apiCall(
  ctx: ToolContext,
  key: string | undefined,
  path: string,
  method = "GET",
  body?: unknown,
  auth = true
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    if (!key) throw new Error(NO_KEY_MSG);
    headers.Authorization = `Bearer ${key}`;
  }
  const res = await fetch(`${ctx.apiUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(formatApiError(res.status, await res.text()));
  }
  return res.json();
}

async function apiDownload(
  ctx: ToolContext,
  key: string | undefined,
  path: string
): Promise<Buffer> {
  if (!key) throw new Error(NO_KEY_MSG);
  const res = await fetch(`${ctx.apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(formatApiError(res.status, await res.text()));
  }
  return Buffer.from(await res.arrayBuffer());
}

// Anything that is not an explicit test key dispatches real email to real
// people, so it gets the confirmation gate (sk_live_ and sk_oat_ both count).
function isLiveKey(key: string | undefined): boolean {
  return !!key && !key.startsWith("sk_test_");
}

function jsonResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

const FIELD_TYPES = [
  "SIGNATURE",
  "NAME",
  "DATE",
  "TEXT",
  "INITIALS",
  "CHECKBOX",
  "RADIO",
  "DROPDOWN",
  "ATTACHMENT",
] as const;

const documentsSchema = z
  .array(
    z.object({
      name: z.string().describe("Document filename (e.g. 'contract.pdf')"),
      base64: z.string().describe("Base64-encoded PDF content"),
    })
  )
  .describe("PDF documents to send");

const recipientsSchema = z
  .array(
    z.object({
      name: z.string().describe("Recipient full name"),
      email: z.string().describe("Recipient email address"),
      role: z.enum(["SIGNER", "CC"]).default("SIGNER"),
      routingOrder: z.number().default(1).describe("Signing order (1 = first)"),
    })
  )
  .describe("People who need to sign or receive a copy");

const fieldsSchema = z
  .array(
    z.object({
      recipientIndex: z
        .number()
        .describe("Index into recipients array (0-based)"),
      type: z.enum(FIELD_TYPES).describe("Field type"),
      document: z.number().default(0).describe("Document index (0-based)"),
      page: z
        .number()
        .describe("Page number (1-based). Ignored when anchor resolves."),
      x: z
        .number()
        .describe("X position, percent 0-100 of page width, top-left origin"),
      y: z
        .number()
        .describe("Y position, percent 0-100 of page height, top-left origin"),
      width: z.number().optional().describe("Field width (percent)"),
      height: z.number().optional().describe("Field height (percent)"),
      anchor: z
        .string()
        .optional()
        .describe(
          "Anchor text to search in the PDF. Use anchor OR page+x+y, not both."
        ),
      yOffset: z.number().optional().describe("Y offset from anchor (percent)"),
      options: z
        .array(z.string())
        .optional()
        .describe("Choices for RADIO / DROPDOWN fields"),
    })
  )
  .describe("Signing fields to place on documents");

const CONFIRM_DESC =
  "Set true to dispatch immediately on a LIVE key (sk_live_/sk_oat_). Without it, live envelopes are created as DRAFT and returned for human review before anything is emailed. Test keys (sk_test_) always send immediately (sandbox, watermarked).";

export function registerSwiftSignTools(server: McpServer, ctx: ToolContext) {
  if (ctx.allowSignup) {
    server.registerTool(
      "swiftsign_signup",
      {
        description:
          "Create a sandbox SwiftSign account and get a test API key (no browser needed). Returns an sk_test_ key for sandbox sends — upgrade with swiftsign_upgrade for live. Set the returned key as SWIFTSIGN_API_KEY to use the other tools.",
        inputSchema: {
          email: z.string().describe("Email address for the new account"),
          name: z.string().optional().describe("Optional account / signer name"),
          source: z
            .string()
            .optional()
            .describe("Attribution tag for where this signup came from"),
        },
        annotations: { openWorldHint: true },
      },
      async (params) =>
        jsonResult(
          await apiCall(
            ctx,
            undefined,
            "/api/v1/signup",
            "POST",
            { ...params, source: params.source ?? ctx.defaultSource ?? "mcp" },
            false
          )
        )
    );
  }

  server.registerTool(
    "swiftsign_send_envelope",
    {
      description:
        "Send a document for e-signature. Accepts PDF as base64, recipients, and field placement. Sandbox keys (sk_test_) send immediately (watermarked test mail). LIVE keys create a DRAFT and return it for human review unless confirm: true — nothing is emailed until confirmed. Field placement: page+x+y (percent, top-left origin) OR an anchor string, not both. After everyone signs, retrieve the sealed PDF with swiftsign_download_signed_pdf.",
      inputSchema: {
        subject: z.string().describe("Email subject / document title"),
        message: z.string().optional().describe("Optional message to include"),
        documents: documentsSchema,
        recipients: recipientsSchema,
        fields: fieldsSchema,
        confirm: z.boolean().optional().describe(CONFIRM_DESC),
      },
      annotations: { destructiveHint: true, openWorldHint: true },
    },
    async (params, extra) => {
      const key = ctx.resolveKey(extra);
      const { confirm, ...envelopeInput } = params;
      const envelope = await apiCall(
        ctx,
        key,
        "/api/v1/envelopes",
        "POST",
        envelopeInput
      );

      if (isLiveKey(key) && !confirm) {
        return jsonResult({
          status: "draft_pending_confirmation",
          sent: false,
          envelopeId: envelope.id,
          dashboardUrl: `${ctx.apiUrl}/dashboard/${envelope.id}`,
          message:
            "LIVE key: envelope created as DRAFT. No email has been sent. Have a human review it at dashboardUrl, then call swiftsign_confirm_send with this envelopeId to dispatch (or re-run with confirm: true if approval already happened).",
        });
      }

      await apiCall(ctx, key, `/api/v1/envelopes/${envelope.id}`, "POST", {
        action: "send",
      });
      return jsonResult({
        success: true,
        envelopeId: envelope.id,
        status: "sent",
        dashboardUrl: `${ctx.apiUrl}/dashboard/${envelope.id}`,
        message: `Document sent to ${params.recipients
          .map((r) => r.email)
          .join(", ")}`,
      });
    }
  );

  server.registerTool(
    "swiftsign_confirm_send",
    {
      description:
        "Dispatch a DRAFT envelope — use after a human has reviewed an envelope that swiftsign_send_envelope or swiftsign_send_from_template returned as draft_pending_confirmation. This emails the signers. Does NOT work on envelopes already SENT/COMPLETED/VOIDED.",
      inputSchema: {
        envelopeId: z.string().describe("The DRAFT envelope ID to dispatch"),
      },
      annotations: { destructiveHint: true, openWorldHint: true },
    },
    async ({ envelopeId }, extra) => {
      const key = ctx.resolveKey(extra);
      const result = await apiCall(
        ctx,
        key,
        `/api/v1/envelopes/${envelopeId}`,
        "POST",
        { action: "send" }
      );
      return jsonResult({
        success: true,
        ...result,
        dashboardUrl: `${ctx.apiUrl}/dashboard/${envelopeId}`,
      });
    }
  );

  server.registerTool(
    "swiftsign_send_from_template",
    {
      description:
        "Send an envelope from a saved template by assigning signers to roles. Sandbox keys (sk_test_) send immediately; LIVE keys create a DRAFT for human review unless confirm: true — nothing is emailed until confirmed.",
      inputSchema: {
        templateId: z.string().describe("The template ID to send from"),
        roleAssignments: z
          .record(
            z.string(),
            z.object({
              name: z.string().describe("Signer full name"),
              email: z.string().describe("Signer email address"),
            })
          )
          .describe("Map of template role name → signer { name, email }"),
        subject: z.string().optional().describe("Email subject / document title"),
        message: z.string().optional().describe("Optional message to include"),
        confirm: z.boolean().optional().describe(CONFIRM_DESC),
      },
      annotations: { destructiveHint: true, openWorldHint: true },
    },
    async (params, extra) => {
      const key = ctx.resolveKey(extra);
      const { confirm, ...templateInput } = params;
      const envelope = await apiCall(
        ctx,
        key,
        "/api/v1/envelopes",
        "POST",
        templateInput
      );

      if (isLiveKey(key) && !confirm) {
        return jsonResult({
          status: "draft_pending_confirmation",
          sent: false,
          envelopeId: envelope.id,
          dashboardUrl: `${ctx.apiUrl}/dashboard/${envelope.id}`,
          message:
            "LIVE key: envelope created as DRAFT from the template. No email has been sent. Have a human review it at dashboardUrl, then call swiftsign_confirm_send with this envelopeId to dispatch.",
        });
      }

      await apiCall(ctx, key, `/api/v1/envelopes/${envelope.id}`, "POST", {
        action: "send",
      });
      return jsonResult({
        success: true,
        envelopeId: envelope.id,
        status: "sent",
        dashboardUrl: `${ctx.apiUrl}/dashboard/${envelope.id}`,
      });
    }
  );

  server.registerTool(
    "swiftsign_check_status",
    {
      description:
        "Check the status of an envelope — who signed, who hasn't, download links. Works in both sandbox (sk_test_ keys) and live.",
      inputSchema: {
        envelopeId: z.string().describe("The envelope ID to check"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ envelopeId }, extra) =>
      jsonResult(
        await apiCall(ctx, ctx.resolveKey(extra), `/api/v1/envelopes/${envelopeId}`)
      )
  );

  server.registerTool(
    "swiftsign_list_envelopes",
    {
      description:
        "List envelopes (sent documents) with their status. Scoped to your key's mode — sandbox (sk_test_) keys see test envelopes, live keys see live.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async (_params, extra) =>
      jsonResult(await apiCall(ctx, ctx.resolveKey(extra), "/api/v1/envelopes"))
  );

  server.registerTool(
    "swiftsign_void_envelope",
    {
      description:
        "Cancel/void an envelope that hasn't been completed yet. Signers can no longer sign a voided envelope. Works in both sandbox (sk_test_ keys) and live.",
      inputSchema: {
        envelopeId: z.string().describe("The envelope ID to void"),
      },
      annotations: { destructiveHint: true },
    },
    async ({ envelopeId }, extra) =>
      jsonResult({
        success: true,
        ...(await apiCall(
          ctx,
          ctx.resolveKey(extra),
          `/api/v1/envelopes/${envelopeId}`,
          "POST",
          { action: "void" }
        )),
      })
  );

  server.registerTool(
    "swiftsign_download_signed_pdf",
    {
      description:
        "Download the completed, sealed PDF (or its Certificate of Completion) for an envelope. Only works once status is COMPLETED — run swiftsign_check_status first. Does NOT work on DRAFT or SENT envelopes; nothing has been signed yet on those.",
      inputSchema: {
        envelopeId: z.string().describe("The envelope ID (must be COMPLETED)"),
        outputPath: z
          .string()
          .optional()
          .describe(
            "Where to save the file (default: ./swiftsign-<id>.pdf). Ignored on the hosted endpoint, which returns base64."
          ),
        document: z
          .number()
          .optional()
          .describe(
            "Which document to download when an envelope has several (0-based, default 0)"
          ),
        certificate: z
          .boolean()
          .optional()
          .describe(
            "If true, download the Certificate of Completion (audit trail) instead of the signed document"
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ envelopeId, outputPath, document, certificate }, extra) => {
      const qs = new URLSearchParams();
      if (typeof document === "number") qs.set("doc", String(document));
      if (certificate) qs.set("certificate", "true");
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      const buffer = await apiDownload(
        ctx,
        ctx.resolveKey(extra),
        `/api/envelopes/${envelopeId}/download${suffix}`
      );

      const dashboardUrl = `${ctx.apiUrl}/dashboard/${envelopeId}`;
      if (ctx.allowFileWrites) {
        const target = resolvePath(
          outputPath ??
            `swiftsign-${envelopeId}${certificate ? "-certificate" : ""}.pdf`
        );
        try {
          await writeFile(target, buffer);
          return jsonResult({
            success: true,
            saved: target,
            bytes: buffer.length,
            dashboardUrl,
          });
        } catch {
          // Filesystem not writable — fall through to base64.
        }
      }
      return jsonResult({
        success: true,
        saved: null,
        bytes: buffer.length,
        base64: buffer.toString("base64"),
        dashboardUrl,
        note: "Decode the base64 and save it yourself.",
      });
    }
  );

  server.registerTool(
    "swiftsign_upgrade",
    {
      description:
        "Initiate the upgrade to PRO ($15/mo flat). Returns a Stripe checkout_url that a human opens once to add a card — agents cannot complete the payment themselves. Moves the account from sandbox (sk_test_) to live sends. Returns status 'updated' if already on the plan.",
      inputSchema: {
        plan: z
          .literal("PRO")
          .optional()
          .describe("Plan to upgrade to (default PRO)"),
      },
      annotations: { openWorldHint: true },
    },
    async (params, extra) =>
      jsonResult(
        await apiCall(
          ctx,
          ctx.resolveKey(extra),
          "/api/v1/billing/upgrade",
          "POST",
          params
        )
      )
  );

  server.registerTool(
    "swiftsign_create_embedded_url",
    {
      description:
        "Mint a short-lived embedded signing URL for a recipient (30-minute expiry). Returns a url to embed plus its expiresAt. The envelope must already be SENT. Works in both sandbox (sk_test_ keys) and live.",
      inputSchema: {
        envelopeId: z.string().describe("The envelope ID"),
        recipientId: z.string().describe("The recipient ID within that envelope"),
        returnUrl: z
          .string()
          .optional()
          .describe("URL to redirect the signer to after they finish"),
      },
      annotations: { openWorldHint: true },
    },
    async ({ envelopeId, recipientId, returnUrl }, extra) =>
      jsonResult(
        await apiCall(
          ctx,
          ctx.resolveKey(extra),
          `/api/v1/envelopes/${envelopeId}/recipients/${recipientId}/embedded-url`,
          "POST",
          { returnUrl }
        )
      )
  );

  server.registerTool(
    "swiftsign_list_templates",
    {
      description:
        "List your saved templates. Scoped to your key's mode — sandbox (sk_test_) keys see test templates, live keys see live.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async (_params, extra) =>
      jsonResult(await apiCall(ctx, ctx.resolveKey(extra), "/api/v1/templates"))
  );
}
