#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";

const API_URL =
  process.env.SWIFTSIGN_API_URL ||
  process.env.SWIFTSIGN_URL ||
  "https://swiftsign.ca";
const API_KEY = process.env.SWIFTSIGN_API_KEY;

// API key is required for everything except swiftsign_signup. Without a key the
// server still starts so an agent can call swiftsign_signup to mint a test key
// (sk_test_ keys are sandbox; upgrade for live), then set SWIFTSIGN_API_KEY.
if (!API_KEY) {
  console.error(
    "SWIFTSIGN_API_KEY not set — only swiftsign_signup is available until you set it. Sandbox keys start with sk_test_; upgrade for live."
  );
}

async function apiCall(
  path: string,
  method = "GET",
  body?: unknown,
  auth = true
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    if (!API_KEY) {
      throw new Error(
        "SWIFTSIGN_API_KEY is not set. Run swiftsign_signup to mint a sandbox key (sk_test_…), then set SWIFTSIGN_API_KEY."
      );
    }
    headers.Authorization = `Bearer ${API_KEY}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(formatApiError(res.status, await res.text()));
  }

  return res.json();
}

// SwiftSign returns RFC 9457 application/problem+json on errors. Surface the
// stable `code` + title + detail so an agent can self-correct (anchor_unresolved
// -> fix the anchor; envelope_quota_exceeded -> upgrade; invalid_state -> wrong
// envelope status) instead of seeing an opaque "API error 500".
function formatApiError(status: number, text: string): string {
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

// Binary download (sealed PDF / certificate) — returns raw bytes, not JSON.
async function apiDownload(path: string): Promise<Buffer> {
  if (!API_KEY) {
    throw new Error(
      "SWIFTSIGN_API_KEY is not set. Run swiftsign_signup to mint a sandbox key, then set SWIFTSIGN_API_KEY."
    );
  }
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(formatApiError(res.status, await res.text()));
  }
  return Buffer.from(await res.arrayBuffer());
}

const server = new McpServer({
  name: "swiftsign",
  version: "0.4.0",
});

// --- Tools ---

server.tool(
  "swiftsign_send_envelope",
  "Send a document for e-signature. Accepts PDF as base64, recipients, and field placement. Sends in whatever mode your key is: sk_test_ keys are sandbox (test sends), live keys send real documents — upgrade with swiftsign_upgrade for live. Auto-sends on create — no separate step. Field placement: set page+x+y (percentages, top-left origin) OR an anchor string, not both. After everyone signs, retrieve the sealed PDF with swiftsign_download_signed_pdf.",
  {
    subject: z.string().describe("Email subject / document title"),
    message: z.string().optional().describe("Optional message to include"),
    documents: z
      .array(
        z.object({
          name: z.string().describe("Document filename (e.g. 'contract.pdf')"),
          base64: z.string().describe("Base64-encoded PDF content"),
        })
      )
      .describe("PDF documents to send"),
    recipients: z
      .array(
        z.object({
          name: z.string().describe("Recipient full name"),
          email: z.string().describe("Recipient email address"),
          role: z.enum(["SIGNER", "CC"]).default("SIGNER"),
          routingOrder: z.number().default(1).describe("Signing order (1 = first)"),
        })
      )
      .describe("People who need to sign or receive a copy"),
    fields: z
      .array(
        z.object({
          recipientIndex: z.number().describe("Index into recipients array (0-based)"),
          type: z
            .enum([
              "SIGNATURE",
              "NAME",
              "DATE",
              "TEXT",
              "INITIALS",
              "CHECKBOX",
              "RADIO",
              "DROPDOWN",
              "ATTACHMENT",
            ])
            .describe("Field type"),
          document: z.number().default(0).describe("Document index (0-based)"),
          page: z.number().describe("Page number (1-based, or -1 for anchor-based)"),
          x: z.number().describe("X position (0-100 percentage)"),
          y: z.number().describe("Y position (0-100 percentage)"),
          width: z.number().optional().describe("Field width (percentage)"),
          height: z.number().optional().describe("Field height (percentage)"),
          anchor: z.string().optional().describe("Anchor text to search in PDF"),
          yOffset: z.number().optional().describe("Y offset from anchor (pixels)"),
        })
      )
      .describe("Signing fields to place on documents"),
  },
  async (params) => {
    const envelope = await apiCall("/api/v1/envelopes", "POST", params);

    // Auto-send after creation
    await apiCall(`/api/v1/envelopes/${envelope.id}`, "POST", {
      action: "send",
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              envelopeId: envelope.id,
              status: "sent",
              dashboardUrl: `${API_URL}/dashboard/${envelope.id}`,
              message: `Document sent to ${params.recipients.map((r) => r.email).join(", ")}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "swiftsign_check_status",
  "Check the status of a sent envelope — who signed, who hasn't, download links. Works in both sandbox (sk_test_ keys) and live.",
  {
    envelopeId: z.string().describe("The envelope ID to check"),
  },
  async ({ envelopeId }) => {
    const envelope = await apiCall(`/api/v1/envelopes/${envelopeId}`);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(envelope, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "swiftsign_download_signed_pdf",
  "Download the completed, sealed PDF (or its Certificate of Completion) for an envelope and save it to a local file. Only works once status is COMPLETED — run swiftsign_check_status first. Does NOT work on DRAFT or SENT envelopes; nothing has been signed yet on those.",
  {
    envelopeId: z.string().describe("The envelope ID (must be COMPLETED)"),
    outputPath: z
      .string()
      .optional()
      .describe(
        "Where to save the file (default: ./swiftsign-<id>.pdf in the current directory)"
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
  async ({ envelopeId, outputPath, document, certificate }) => {
    const qs = new URLSearchParams();
    if (typeof document === "number") qs.set("doc", String(document));
    if (certificate) qs.set("certificate", "true");
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const buffer = await apiDownload(
      `/api/envelopes/${envelopeId}/download${suffix}`
    );

    const target = resolvePath(
      outputPath ?? `swiftsign-${envelopeId}${certificate ? "-certificate" : ""}.pdf`
    );
    let saved: string | null = null;
    try {
      await writeFile(target, buffer);
      saved = target;
    } catch {
      // Filesystem not writable (e.g. a sandbox) — fall back to base64.
    }

    const result = saved
      ? {
          success: true,
          saved,
          bytes: buffer.length,
          dashboardUrl: `${API_URL}/dashboard/${envelopeId}`,
        }
      : {
          success: true,
          saved: null,
          bytes: buffer.length,
          base64: buffer.toString("base64"),
          dashboardUrl: `${API_URL}/dashboard/${envelopeId}`,
          note: "Could not write to disk; returning base64 — decode and save it yourself.",
        };

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  }
);

server.tool(
  "swiftsign_list_envelopes",
  "List all envelopes (sent documents) with their status. Scoped to your key's mode — sandbox (sk_test_) keys see test envelopes, live keys see live.",
  {},
  async () => {
    const envelopes = await apiCall("/api/v1/envelopes");

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(envelopes, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "swiftsign_void_envelope",
  "Cancel/void an envelope that hasn't been completed yet. Works in both sandbox (sk_test_ keys) and live.",
  {
    envelopeId: z.string().describe("The envelope ID to void"),
  },
  async ({ envelopeId }) => {
    const result = await apiCall(`/api/v1/envelopes/${envelopeId}`, "POST", {
      action: "void",
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ success: true, ...result }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "swiftsign_signup",
  "Create a sandbox SwiftSign account and get a test API key (no browser needed). Returns an sk_test_ key for sandbox sends — upgrade with swiftsign_upgrade for live. Set the returned key as SWIFTSIGN_API_KEY to use the other tools.",
  {
    email: z.string().describe("Email address for the new account"),
    name: z.string().optional().describe("Optional account / signer name"),
  },
  async (params) => {
    const result = await apiCall(
      "/api/v1/signup",
      "POST",
      params,
      false // no auth header for signup
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "swiftsign_upgrade",
  "Get a Stripe pay link to upgrade to PRO (the dev opens it once to add a card). Moves you from sandbox (sk_test_) to live sends. Returns a checkout_url to open, or status 'updated' if already on the plan.",
  {
    plan: z.literal("PRO").optional().describe("Plan to upgrade to (default PRO)"),
  },
  async (params) => {
    const result = await apiCall("/api/v1/billing/upgrade", "POST", params);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "swiftsign_send_from_template",
  "Send an envelope from a saved template by assigning signers to roles. Sends in your key's mode: sk_test_ keys are sandbox, live keys send real documents — upgrade with swiftsign_upgrade for live.",
  {
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
  },
  async (params) => {
    const envelope = await apiCall("/api/v1/envelopes", "POST", params);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(envelope, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "swiftsign_create_embedded_url",
  "Mint a short-lived embedded signing URL for a recipient. Returns a url to embed plus its expiresAt. Works in both sandbox (sk_test_ keys) and live.",
  {
    envelopeId: z.string().describe("The envelope ID"),
    recipientId: z.string().describe("The recipient ID within that envelope"),
    returnUrl: z
      .string()
      .optional()
      .describe("URL to redirect the signer to after they finish"),
  },
  async ({ envelopeId, recipientId, returnUrl }) => {
    const result = await apiCall(
      `/api/v1/envelopes/${envelopeId}/recipients/${recipientId}/embedded-url`,
      "POST",
      { returnUrl }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "swiftsign_list_templates",
  "List your saved templates. Scoped to your key's mode — sandbox (sk_test_) keys see test templates, live keys see live.",
  {},
  async () => {
    const result = await apiCall("/api/v1/templates");

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server error:", error);
  process.exit(1);
});
