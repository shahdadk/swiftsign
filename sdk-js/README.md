# swiftsign

The official TypeScript SDK for the [SwiftSign](https://swiftsign.ca) e-signature API. A small, hand-written, fetch-based client with full types and no generated bloat.

- Zero runtime dependencies. Works in Node 18+, Bun, Deno, edge runtimes, and the browser.
- Typed inputs and outputs for every endpoint.
- Typed errors (`SwiftSignError`) with stable `code`, `status`, and `requestId`.
- Automatic idempotency keys on envelope creation.
- A tiny `embed()` helper for in-app signing.

## Install

```bash
npm install swiftsign
```

## 5-minute quickstart

Get a sandbox API key with one unauthenticated call, then create, send, and track an envelope.

```ts
import { SwiftSign } from "swiftsign";
import { readFileSync } from "node:fs";

// 1. Get a sandbox key (test mode — sends are watermarked and free).
const { api_key } = await SwiftSign.signup({ email: "you@example.com" });

// 2. Create a client.
const swiftsign = new SwiftSign(api_key);

// 3. Create an envelope from a local PDF. The SIGNATURE field is placed next
//    to the text "Sign here" via an anchor — no pixel math required.
const base64 = readFileSync("./contract.pdf").toString("base64");

const envelope = await swiftsign.envelopes.create({
  subject: "Please sign: Mutual NDA",
  message: "Quick signature needed before Friday.",
  documents: [{ name: "contract.pdf", base64 }],
  recipients: [{ name: "Ada Lovelace", email: "ada@example.com" }],
  fields: [
    { recipientIndex: 0, document: 0, type: "SIGNATURE", anchor: "Sign here" },
  ],
});

// 4. Send it. The first signer gets an email with their signing link.
await swiftsign.envelopes.send(envelope.id);

// 5. Check on it later.
const fresh = await swiftsign.envelopes.get(envelope.id);
console.log(fresh.status); // "SENT" → "COMPLETED"
```

That's the whole loop: sign up, create, send, track. Verify your email and add a card in the dashboard to switch from test to live.

## Configuration

```ts
const swiftsign = new SwiftSign(process.env.SWIFTSIGN_API_KEY!, {
  baseUrl: "https://swiftsign.ca", // default; override for self-hosted
});
```

The API key is sent as `Authorization: Bearer <apiKey>` on every request except `signup`.

## Errors

Every non-2xx response throws a `SwiftSignError`. Branch on `code` (stable across versions), not on the message.

```ts
import { SwiftSign, SwiftSignError } from "swiftsign";

try {
  await swiftsign.envelopes.get("env_does_not_exist");
} catch (err) {
  if (err instanceof SwiftSignError) {
    console.error(err.code);      // e.g. "envelope_not_found"
    console.error(err.status);    // 404
    console.error(err.requestId); // "req_..." — include when contacting support
    console.error(err.detail);    // human-readable detail, if any
    console.error(err.problem);   // raw RFC 9457 problem body
  }
}
```

## Envelopes

```ts
// Inline create (documents + recipients + fields)
const env = await swiftsign.envelopes.create({
  subject: "Offer letter",
  documents: [{ name: "offer.pdf", base64 }],
  recipients: [
    { name: "Grace", email: "grace@example.com", routingOrder: 1 },
    { name: "HR", email: "hr@example.com", role: "CC", routingOrder: 2 },
  ],
  fields: [
    { recipientIndex: 0, document: 0, type: "SIGNATURE", page: 1, x: 20, y: 80, width: 30, height: 6 },
    { recipientIndex: 0, document: 0, type: "DATE", anchor: "Date:" },
  ],
});

// Create from a saved template
const fromTemplate = await swiftsign.envelopes.create({
  templateId: "tmpl_123",
  roleAssignments: {
    Signer: { name: "Grace Hopper", email: "grace@example.com" },
  },
  subject: "Offer letter (Grace)",
});

// List with cursor pagination and filters
const page = await swiftsign.envelopes.list({ status: "SENT", limit: 25 });
for (const e of page.data) console.log(e.id, e.status);
if (page.has_more) {
  const next = await swiftsign.envelopes.list({ cursor: page.next_cursor! });
}

await swiftsign.envelopes.get(env.id);
await swiftsign.envelopes.send(env.id);   // { status: "sent",   envelopeId }
await swiftsign.envelopes.void(env.id);   // { status: "voided", envelopeId }
```

Field coordinates (`x`, `y`, `width`, `height`) are percentages (0–100) of the page with a top-left origin. Use an `anchor` string to position relative to matching text instead.

## Templates

```ts
const tmpl = await swiftsign.templates.create({
  name: "Standard NDA",
  documents: [{ name: "nda.pdf", base64 }],
  roles: [{ roleName: "Signer", routingOrder: 1 }],
  fields: [{ role: 0, document: 0, type: "SIGNATURE", anchor: "Signature" }],
});

await swiftsign.templates.list();
await swiftsign.templates.get(tmpl.id);
await swiftsign.templates.update(tmpl.id, { description: "v2" });
await swiftsign.templates.delete(tmpl.id);
```

## Embedded signing

Mint a single-use URL and drop it into an iframe. In Node, you get the URL; in the browser, the `embed()` helper wires up the `swiftsign:completed` postMessage for you.

```ts
// Server / Node
const { url } = await swiftsign.envelopes.createEmbeddedUrl(
  envelopeId,
  recipientId,
  { returnUrl: "https://app.example.com/signed" } // optional, must be https
);
```

```ts
// Browser
import { embed } from "swiftsign";

const handle = embed({
  url,                       // from createEmbeddedUrl
  container: "#sign",        // HTMLElement or CSS selector
  onComplete: ({ envelopeId }) => {
    console.log("signed", envelopeId);
    handle.destroy();
  },
});
```

## Billing

```ts
const result = await swiftsign.billing.upgradeUrl({ plan: "PRO" });
if ("checkout_url" in result) {
  // redirect the user to Stripe Checkout
  window.location.href = result.checkout_url;
} else {
  // result.status === "updated"
}
```

## License

MIT
