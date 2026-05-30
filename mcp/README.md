# swiftsign-mcp

MCP server for [SwiftSign](https://swiftsign.ca) — send documents for e-signature directly from Claude Code.

## Setup

Add to your `.mcp.json` (Claude Code config):

```json
{
  "mcpServers": {
    "swiftsign": {
      "command": "npx",
      "args": ["-y", "swiftsign-mcp"],
      "env": {
        "SWIFTSIGN_API_KEY": "sk_your_api_key"
      }
    }
  }
}
```

Get your API key at [swiftsign.ca/dashboard](https://swiftsign.ca/dashboard) — or skip the browser entirely and call `swiftsign_signup` to mint a sandbox key (see below).

## Test → live keys

SwiftSign keys come in two flavors:

- **Sandbox** keys start with `sk_test_`. Everything works (send, status, templates, embedded URLs) but documents are test sends. No card needed.
- **Live** keys send real, legally binding documents. Upgrade once with `swiftsign_upgrade` (a Stripe pay link the dev opens to add a card).

The same tools work in both modes; the mode is determined by the key in `SWIFTSIGN_API_KEY`.

## Agent-native flow (no browser)

An agent can go from zero to a live e-signature without ever opening a dashboard:

1. **`swiftsign_signup`** — create a sandbox account, get an `sk_test_` key back. Set it as `SWIFTSIGN_API_KEY`.
2. **`swiftsign_send_envelope`** (or `swiftsign_send_from_template`) — send a test document and watch the full flow work.
3. **`swiftsign_upgrade`** — get a Stripe checkout link; the dev opens it once to add a card. Now sends are live.

`swiftsign_signup` is the only tool that works without a key set — it's how you get one.

## Tools

| Tool | Description |
|------|-------------|
| `swiftsign_signup` | Create a sandbox account and get a test API key (no browser) |
| `swiftsign_send_envelope` | Send document(s) for e-signature |
| `swiftsign_send_from_template` | Send an envelope from a saved template by role |
| `swiftsign_check_status` | Check envelope signing status |
| `swiftsign_list_envelopes` | List all sent envelopes |
| `swiftsign_list_templates` | List your saved templates |
| `swiftsign_create_embedded_url` | Mint a short-lived embedded signing URL |
| `swiftsign_void_envelope` | Cancel an envelope |
| `swiftsign_upgrade` | Get a Stripe pay link to upgrade to PRO (live sends) |

## Usage

Once configured, just ask Claude:

```
"Send this contract to john@acme.com for signing"
```

Claude will use SwiftSign to send the document, place signature fields, and email the recipient a signing link.

## Example

```
"Send the MSA at data/contracts/generated/Acme_MSA.pdf to John Smith (john@acme.com) for signing, with a signature field at the bottom"
```

SwiftSign handles:
- Secure signing link (no account needed for signer)
- E-sign consent (legally compliant)
- Signature capture (draw, type, or upload)
- Document sealing with SHA-256 hash
- Certificate of Completion
- Email notifications to all parties

## Legal Compliance

SwiftSign e-signatures are legally binding under:
- **Canada**: Electronic Commerce Act (Ontario), PIPEDA
- **United States**: ESIGN Act, UETA

## Links

- [Dashboard](https://swiftsign.ca/dashboard)
- [API Docs](https://swiftsign.ca/docs)
- [Website](https://swiftsign.ca)
