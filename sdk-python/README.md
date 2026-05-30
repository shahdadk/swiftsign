# SwiftSign Python SDK

The official Python client for the [SwiftSign](https://swiftsign.ca) e-signature API. Send documents for signature, manage templates, and embed signing — all from Python.

Built on `httpx` and `pydantic` v2. Python 3.9+.

## Install

```bash
pip install swiftsign
```

## Quickstart (5 minutes)

### 1. Get an API key

No browser needed. One call provisions a sandbox account and returns a test key. Sandbox sends are free and watermarked.

```python
from swiftsign import SwiftSign

acct = SwiftSign.signup("you@example.com", name="You")
print(acct.api_key)   # sk_test_...
print(acct.mode)      # "test"
```

Already have a key? Skip straight to step 2.

### 2. Create the client

```python
client = SwiftSign(acct.api_key)
# or point at another environment:
# client = SwiftSign(api_key, base_url="https://staging.swiftsign.ca")
```

The key is sent as `Authorization: Bearer <api_key>` on every call.

### 3. Send a document for signature

Pass PDFs as base64. Field coordinates are percentages (0–100) of the page, top-left origin.

```python
import base64

pdf_b64 = base64.b64encode(open("nda.pdf", "rb").read()).decode()

env = client.envelopes.create(
    subject="Please sign the NDA",
    message="Quick signature needed — thanks!",
    documents=[{"name": "nda.pdf", "base64": pdf_b64}],
    recipients=[{"name": "Sam Carter", "email": "sam@example.com"}],
    fields=[
        {"recipientIndex": 0, "type": "SIGNATURE",
         "document": 0, "page": 1, "x": 20, "y": 80},
        {"recipientIndex": 0, "type": "DATE",
         "document": 0, "page": 1, "x": 60, "y": 80},
    ],
)

# Envelopes are created as DRAFT; send to email the first signer.
client.envelopes.send(env.id)
print(env.id, env.status)
```

`create` automatically attaches a unique `Idempotency-Key` header, so a retried
call after a network blip won't create a duplicate envelope.

### 4. Track and manage

```python
# Fetch full state (documents, recipients, fields, audit log)
env = client.envelopes.get(env.id)

# List, filter, paginate
page = client.envelopes.list(status="SENT", limit=20)
for e in page.data:
    print(e.id, e.subject, e.status)
if page.has_more:
    page = client.envelopes.list(cursor=page.next_cursor)

# Void if needed
client.envelopes.void(env.id)
```

## Embedded signing

Mint a single-use URL to drop a signer into an iframe. The envelope must be SENT.

```python
env = client.envelopes.get(env.id)
recipient_id = env.recipients[0]["id"]  # nested fields are preserved on the model

session = client.envelopes.create_embedded_url(
    env.id, recipient_id, return_url="https://yourapp.com/done"
)
print(session.url)  # https://swiftsign.ca/embed/<token>
```

## Templates

Reuse a document + role + field layout across many envelopes.

```python
tmpl = client.templates.create(
    name="Standard NDA",
    description="Mutual NDA, single signer",
    documents=[{"name": "nda.pdf", "base64": pdf_b64}],
    roles=[{"roleName": "Signer", "routingOrder": 1}],
    fields=[{"role": 0, "document": 0, "type": "SIGNATURE",
             "page": 1, "x": 20, "y": 80}],
)

# Send an envelope from the template — just assign people to roles.
env = client.envelopes.create(
    template_id=tmpl.id,
    role_assignments={"Signer": {"name": "Sam Carter", "email": "sam@example.com"}},
    subject="Please sign the NDA",
)
client.envelopes.send(env.id)

# Manage templates
client.templates.list()
client.templates.get(tmpl.id)
client.templates.update(tmpl.id, name="NDA v2")
client.templates.delete(tmpl.id)
```

## Go live

Test keys send watermarked, free envelopes. To send real documents, verify your
email and upgrade:

```python
result = client.billing.upgrade_url(plan="PRO")
if result.checkout_url:
    print("Open to complete payment:", result.checkout_url)
else:
    print("Plan updated:", result.status)
```

## Error handling

Every non-2xx response raises `SwiftSignError`, which carries the
RFC 9457 problem fields.

```python
from swiftsign import SwiftSignError

try:
    client.envelopes.get("does-not-exist")
except SwiftSignError as e:
    print(e.status)       # 404
    print(e.code)         # "envelope_not_found"
    print(e.detail)       # human-readable explanation
    print(e.request_id)   # quote this in support requests
    print(e.problem)      # raw problem+json dict
```

## Reference

| Call | Description |
| --- | --- |
| `SwiftSign.signup(email, name=None)` | Provision a sandbox account, no auth |
| `SwiftSign(api_key, base_url=...)` | Construct an authenticated client |
| `client.envelopes.create(...)` | Create inline or from a template (auto idempotency) |
| `client.envelopes.list(...)` | List with `cursor`, `limit`, `status`, `mode`, `created_after`, `created_before`, `recipient_email` |
| `client.envelopes.get(id)` | Fetch one envelope |
| `client.envelopes.send(id)` | Send a DRAFT envelope |
| `client.envelopes.void(id)` | Void an envelope |
| `client.envelopes.create_embedded_url(id, recipient_id, return_url=None)` | Mint an embedded signing URL |
| `client.templates.create(...)` | Create a template |
| `client.templates.list()` / `.get(id)` / `.update(id, ...)` / `.delete(id)` | Manage templates |
| `client.billing.upgrade_url(plan="PRO")` | Start a plan upgrade |

Full API docs: [swiftsign.ca/docs](https://swiftsign.ca/docs)

## License

MIT
