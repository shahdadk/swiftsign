"""SwiftSign — Python SDK for the SwiftSign e-signature API.

Quickstart:

    from swiftsign import SwiftSign

    acct = SwiftSign.signup("you@example.com", name="You")
    client = SwiftSign(acct.api_key)

    env = client.envelopes.create(
        subject="Please sign",
        documents=[{"name": "nda.pdf", "base64": pdf_b64}],
        recipients=[{"name": "Sam", "email": "sam@example.com"}],
        fields=[{"recipientIndex": 0, "type": "SIGNATURE",
                 "document": 0, "page": 1, "x": 20, "y": 80}],
    )
    client.envelopes.send(env.id)
"""

from .client import SwiftSign
from .errors import SwiftSignError
from .models import (
    ActionResult,
    ApiKeyView,
    EmbeddedSigningUrl,
    Envelope,
    EnvelopeSummary,
    Page,
    SignupResult,
    Template,
    TemplateSummary,
    UpgradeResult,
)

__version__ = "0.1.0"

__all__ = [
    "SwiftSign",
    "SwiftSignError",
    "ActionResult",
    "ApiKeyView",
    "EmbeddedSigningUrl",
    "Envelope",
    "EnvelopeSummary",
    "Page",
    "SignupResult",
    "Template",
    "TemplateSummary",
    "UpgradeResult",
    "__version__",
]
