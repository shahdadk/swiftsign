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

Get your API key at [swiftsign.ca/dashboard](https://swiftsign.ca/dashboard).

## Tools

| Tool | Description |
|------|-------------|
| `swiftsign_send_envelope` | Send document(s) for e-signature |
| `swiftsign_check_status` | Check envelope signing status |
| `swiftsign_list_envelopes` | List all sent envelopes |
| `swiftsign_void_envelope` | Cancel an envelope |

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
