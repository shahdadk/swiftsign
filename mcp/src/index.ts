#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSwiftSignTools } from "./tools.js";

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

const server = new McpServer({
  name: "swiftsign",
  version: "0.5.0",
});

registerSwiftSignTools(server, {
  apiUrl: API_URL,
  resolveKey: () => process.env.SWIFTSIGN_API_KEY,
  allowFileWrites: true,
  allowSignup: true,
  defaultSource: "mcp",
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server error:", error);
  process.exit(1);
});
