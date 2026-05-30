"""Synchronous SwiftSign API client built on httpx + pydantic v2."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

import httpx

from .errors import SwiftSignError
from .models import (
    ActionResult,
    EmbeddedSigningUrl,
    Envelope,
    EnvelopeSummary,
    Page,
    SignupResult,
    Template,
    TemplateSummary,
    UpgradeResult,
)

DEFAULT_BASE_URL = "https://swiftsign.ca"
DEFAULT_TIMEOUT = 60.0


def _drop_none(d: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in d.items() if v is not None}


class SwiftSign:
    """Client for the SwiftSign e-signature API.

    Args:
        api_key: A SwiftSign API key (``sk_test_...`` or ``sk_live_...``). Sent
            as ``Authorization: Bearer <api_key>`` on every authenticated call.
        base_url: API base URL. Defaults to ``https://swiftsign.ca``.
        timeout: Per-request timeout in seconds.
        http_client: Optional pre-configured ``httpx.Client`` to reuse.

    Example:
        >>> client = SwiftSign("sk_test_...")
        >>> env = client.envelopes.create(
        ...     subject="Please sign",
        ...     documents=[{"name": "nda.pdf", "base64": "..."}],
        ...     recipients=[{"name": "Sam", "email": "sam@example.com"}],
        ... )
        >>> client.envelopes.send(env.id)
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        *,
        timeout: float = DEFAULT_TIMEOUT,
        http_client: Optional[httpx.Client] = None,
    ) -> None:
        if not api_key:
            raise ValueError("api_key is required")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._owns_client = http_client is None
        self._http = http_client or httpx.Client(timeout=timeout)

        self.envelopes = EnvelopesResource(self)
        self.templates = TemplatesResource(self)
        self.billing = BillingResource(self)

    # ---- lifecycle -------------------------------------------------------

    def close(self) -> None:
        """Close the underlying HTTP client (if owned by this instance)."""
        if self._owns_client:
            self._http.close()

    def __enter__(self) -> "SwiftSign":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    # ---- signup (classmethod, no auth) -----------------------------------

    @classmethod
    def signup(
        cls,
        email: str,
        name: Optional[str] = None,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> SignupResult:
        """Provision a sandbox account and mint a test API key. No auth required.

        Returns a :class:`~swiftsign.models.SignupResult` carrying ``api_key``,
        ``mode``, ``key`` and onboarding URLs. Pass the returned ``api_key`` to
        :class:`SwiftSign` to start making authenticated calls.
        """
        url = base_url.rstrip("/") + "/api/v1/signup"
        body = _drop_none({"email": email, "name": name})
        with httpx.Client(timeout=timeout) as http:
            resp = http.post(url, json=body, headers={"Accept": "application/json"})
        data = _parse(resp)
        return SignupResult.model_validate(data)

    # ---- request helper --------------------------------------------------

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }
        if extra:
            headers.update(extra)
        return headers

    def _request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        resp = self._http.request(
            method,
            self.base_url + path,
            json=json,
            params=_drop_none(params) if params else None,
            headers=self._headers(headers),
        )
        return _parse(resp)


def _parse(resp: httpx.Response) -> Any:
    """Parse a response, raising :class:`SwiftSignError` on non-2xx."""
    if 200 <= resp.status_code < 300:
        if resp.status_code == 204 or not resp.content:
            return None
        try:
            return resp.json()
        except ValueError:
            return None
    try:
        body = resp.json()
    except ValueError:
        body = {"detail": resp.text}
    raise SwiftSignError.from_response(resp.status_code, body)


class EnvelopesResource:
    """``client.envelopes.*`` — create, list, fetch, send, void envelopes."""

    def __init__(self, client: SwiftSign) -> None:
        self._client = client

    def create(
        self,
        *,
        # Inline envelope
        subject: Optional[str] = None,
        documents: Optional[List[Dict[str, Any]]] = None,
        recipients: Optional[List[Dict[str, Any]]] = None,
        fields: Optional[List[Dict[str, Any]]] = None,
        message: Optional[str] = None,
        # Template envelope
        template_id: Optional[str] = None,
        role_assignments: Optional[Dict[str, Dict[str, str]]] = None,
        idempotency_key: Optional[str] = None,
    ) -> Envelope:
        """Create an envelope, either inline or from a template.

        An ``Idempotency-Key`` header is generated automatically (uuid4) unless
        you pass ``idempotency_key`` explicitly — safe to retry on network error.

        Inline:
            create(subject=..., documents=[{name, base64}],
                   recipients=[{name, email, role?, routingOrder?}],
                   fields=[{recipientIndex, type, document, ...}])

        From template:
            create(template_id=..., role_assignments={role: {name, email}},
                   subject=..., message=...)
        """
        if template_id is not None:
            if role_assignments is None:
                raise ValueError("role_assignments is required when template_id is set")
            payload: Dict[str, Any] = _drop_none(
                {
                    "templateId": template_id,
                    "roleAssignments": role_assignments,
                    "subject": subject,
                    "message": message,
                }
            )
        else:
            if subject is None or documents is None or recipients is None:
                raise ValueError(
                    "Inline create requires subject, documents and recipients"
                )
            payload = _drop_none(
                {
                    "subject": subject,
                    "message": message,
                    "documents": documents,
                    "recipients": recipients,
                    "fields": fields if fields is not None else [],
                }
            )
        headers = {"Idempotency-Key": idempotency_key or str(uuid.uuid4())}
        data = self._client._request(
            "POST", "/api/v1/envelopes", json=payload, headers=headers
        )
        return Envelope.model_validate(data)

    def list(
        self,
        *,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
        status: Optional[str] = None,
        mode: Optional[str] = None,
        created_after: Optional[str] = None,
        created_before: Optional[str] = None,
        recipient_email: Optional[str] = None,
    ) -> Page:
        """List envelopes (cursor-paginated).

        Returns a :class:`~swiftsign.models.Page` whose ``data`` is a list of
        :class:`~swiftsign.models.EnvelopeSummary`. Use ``next_cursor`` /
        ``cursor`` to page when ``has_more`` is ``True``.
        """
        params = {
            "cursor": cursor,
            "limit": limit,
            "status": status,
            "mode": mode,
            "created_after": created_after,
            "created_before": created_before,
            "recipient_email": recipient_email,
        }
        data = self._client._request("GET", "/api/v1/envelopes", params=params)
        page = Page.model_validate(data)
        page.data = [EnvelopeSummary.model_validate(item) for item in page.data]
        return page

    def get(self, envelope_id: str) -> Envelope:
        """Fetch a single envelope, including documents, recipients and audit log."""
        data = self._client._request("GET", f"/api/v1/envelopes/{envelope_id}")
        return Envelope.model_validate(data)

    def send(self, envelope_id: str) -> ActionResult:
        """Send a DRAFT envelope (POST ``action=send``)."""
        data = self._client._request(
            "POST", f"/api/v1/envelopes/{envelope_id}", json={"action": "send"}
        )
        return ActionResult.model_validate(data)

    def void(self, envelope_id: str) -> ActionResult:
        """Void an envelope (POST ``action=void``)."""
        data = self._client._request(
            "POST", f"/api/v1/envelopes/{envelope_id}", json={"action": "void"}
        )
        return ActionResult.model_validate(data)

    def create_embedded_url(
        self,
        envelope_id: str,
        recipient_id: str,
        return_url: Optional[str] = None,
    ) -> EmbeddedSigningUrl:
        """Mint a single-use embedded signing URL for a recipient.

        The envelope must be SENT and the recipient a signer who has not yet
        signed/declined. ``return_url`` (if given) must be https.
        """
        body = _drop_none({"returnUrl": return_url})
        data = self._client._request(
            "POST",
            f"/api/v1/envelopes/{envelope_id}/recipients/{recipient_id}/embedded-url",
            json=body,
        )
        return EmbeddedSigningUrl.model_validate(data)


class TemplatesResource:
    """``client.templates.*`` — manage reusable envelope templates."""

    def __init__(self, client: SwiftSign) -> None:
        self._client = client

    def create(
        self,
        *,
        name: str,
        documents: List[Dict[str, Any]],
        roles: List[Dict[str, Any]],
        fields: Optional[List[Dict[str, Any]]] = None,
        description: Optional[str] = None,
    ) -> Template:
        """Create a template from documents, roles and fields."""
        payload = _drop_none(
            {
                "name": name,
                "description": description,
                "documents": documents,
                "roles": roles,
                "fields": fields if fields is not None else [],
            }
        )
        data = self._client._request("POST", "/api/v1/templates", json=payload)
        return Template.model_validate(data)

    def list(
        self,
        *,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> Page:
        """List templates (cursor-paginated).

        ``data`` is a list of :class:`~swiftsign.models.TemplateSummary`.
        """
        params = {"cursor": cursor, "limit": limit}
        data = self._client._request("GET", "/api/v1/templates", params=params)
        page = Page.model_validate(data)
        page.data = [TemplateSummary.model_validate(item) for item in page.data]
        return page

    def get(self, template_id: str) -> Template:
        """Fetch a single template, including documents, roles and fields."""
        data = self._client._request("GET", f"/api/v1/templates/{template_id}")
        return Template.model_validate(data)

    def update(
        self,
        template_id: str,
        *,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Template:
        """Update a template's name and/or description (at least one required)."""
        if name is None and description is None:
            raise ValueError("Provide at least one of name or description")
        body: Dict[str, Any] = {}
        if name is not None:
            body["name"] = name
        if description is not None:
            body["description"] = description
        data = self._client._request(
            "PATCH", f"/api/v1/templates/{template_id}", json=body
        )
        return Template.model_validate(data)

    def delete(self, template_id: str) -> None:
        """Delete a template (cascades to its documents, roles and fields)."""
        self._client._request("DELETE", f"/api/v1/templates/{template_id}")
        return None


class BillingResource:
    """``client.billing.*`` — plan upgrades."""

    def __init__(self, client: SwiftSign) -> None:
        self._client = client

    def upgrade_url(self, plan: str = "PRO") -> UpgradeResult:
        """Start a plan upgrade.

        Returns an :class:`~swiftsign.models.UpgradeResult`. Either
        ``checkout_url`` is set (open it to complete payment) or ``status`` is
        ``'updated'`` (plan changed without checkout).
        """
        data = self._client._request(
            "POST", "/api/v1/billing/upgrade", json={"plan": plan}
        )
        return UpgradeResult.model_validate(data)
