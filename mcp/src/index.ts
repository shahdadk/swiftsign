#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL =
  process.env.SWIFTSIGN_API_URL ||
  process.env.SWIFTSIGN_URL ||
  "https://swiftsign.ca";
const API_KEY = process.env.SWIFTSIGN_API_KEY;

if (!API_KEY) {
  console.error("SWIFTSIGN_API_KEY environment variable is required");
  process.exit(1);
}

async function apiCall(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
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
  version: "0.1.0",
});

// --- Tools ---

server.tool(
  "swiftsign_send_envelope",
  "Send a document for e-signature. Accepts PDF as base64, recipients, and field placement.",
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
  "Check the status of a sent envelope — who signed, who hasn't, download links.",
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
  "List all envelopes (sent documents) with their status.",
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
  "Cancel/void an envelope that hasn't been completed yet.",
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

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server error:", error);
  process.exit(1);
});
