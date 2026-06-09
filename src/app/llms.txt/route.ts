// /llms.txt per the llmstxt.org convention: a terse, factual markdown map of
// the site for LLMs and AI crawlers. Served as text/plain, statically.

export const dynamic = "force-static";

const BODY = `# SwiftSign

> SwiftSign is an e-signature API and MCP server built for AI coding tools. One unauthenticated call (POST https://swiftsign.ca/api/v1/signup) returns an instant sk_test_ sandbox key, no account required. Sandbox is free forever with unlimited watermarked test envelopes. Pro is $15/month flat per workspace for live sends.

Completed documents are sealed with a SHA-256 hash, a PAdES (PKCS#7) digital signature, and an RFC-3161 trusted timestamp, plus a Certificate of Completion recording the audit trail. Signatures are intended to be legally binding under the U.S. ESIGN Act, UETA, and Canada's PIPEDA.

## Docs

- [Quickstart](https://swiftsign.ca/docs): install, get a key, send a sandbox envelope, go live
- [API explorer](https://swiftsign.ca/reference): interactive reference for every endpoint
- [OpenAPI spec](https://swiftsign.ca/openapi.json): machine-readable API description

## Install

- Claude Code: \`claude mcp add swiftsign -- npx -y swiftsign-mcp\`
- Any MCP-aware client (Cursor, Zed, etc.): run \`npx -y swiftsign-mcp\` as a stdio server
- A hosted remote MCP URL is coming; use npx for now
- [Node SDK](https://www.npmjs.com/package/swiftsign): \`npm install swiftsign\`
- [Python SDK](https://pypi.org/project/swiftsign/): \`pip install swiftsign\`

## Pricing

- [Pricing](https://swiftsign.ca/pricing): Sandbox is free forever with unlimited test envelopes. Pro is $15/month flat per workspace, fair use 100 envelopes/month.

## Trust

- [Trust](https://swiftsign.ca/trust): email authentication on signing mail, document integrity and sealing, data location, deletion on request, abuse reporting

## Legal

- [Terms of Service](https://swiftsign.ca/legal/terms)
- [Privacy Policy](https://swiftsign.ca/legal/privacy)
- [Data Processing Addendum](https://swiftsign.ca/legal/dpa)
- [Acceptable Use Policy](https://swiftsign.ca/legal/acceptable-use)
`;

export function GET() {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
