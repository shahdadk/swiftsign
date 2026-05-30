#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

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
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

const server = new McpServer({
  name: "swiftsign",
  version: "0.3.0",
});

// --- Tools ---

server.tool(
  "swiftsign_send_envelope",
  "Send a document for e-signature. Accepts PDF as base64, recipients, and field placement. Sends in whatever mode your key is: sk_test_ keys are sandbox (test sends), live keys send real documents — upgrade with swiftsign_upgrade for live.",
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
            .enum(["SIGNATURE", "NAME", "DATE", "TEXT", "INITIALS", "CHECKBOX"])
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
