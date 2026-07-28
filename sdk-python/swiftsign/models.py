"""Pydantic v2 models for the main SwiftSign response shapes.

Every model sets ``extra='allow'`` so additional or nested fields the API
returns (documents, recipients, fields, audit logs, etc.) are preserved on the
instance even though only the commonly-used fields are typed here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict


class _Base(BaseModel):
    model_config = ConfigDict(extra="allow")


class ApiKeyView(_Base):
    """Public view of an API key (the ``key`` field returned by signup)."""

    id: str
    name: Optional[str] = None
    mode: Optional[str] = None
    prefix: Optional[str] = None
    last4: Optional[str] = None
    scopes: List[str] = []
    lastUsedAt: Optional[datetime] = None
    expiresAt: Optional[datetime] = None
    revokedAt: Optional[datetime] = None
    createdAt: Optional[datetime] = None


class SignupResult(_Base):
    """Response from ``POST /api/v1/signup``."""

    api_key: str
    mode: Optional[str] = None
    key: Optional[ApiKeyView] = None
    message: Optional[str] = None
    verify_url: Optional[str] = None
    docs_url: Optional[str] = None
    terms_url: Optional[str] = None
    privacy_url: Optional[str] = None


class Envelope(_Base):
    """A signing envelope.

    The full ``get`` response also carries ``documents``, ``recipients`` (each
    with ``fields``) and ``auditLogs`` — all available via ``extra`` attributes
    or ``model_extra``.
    """

    id: str
    subject: Optional[str] = None
    message: Optional[str] = None
    status: Optional[str] = None
    livemode: Optional[bool] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class EnvelopeSummary(_Base):
    """Condensed envelope as returned in list pages."""

    id: str
    subject: Optional[str] = None
    status: Optional[str] = None
    livemode: Optional[bool] = None
    createdAt: Optional[datetime] = None
    recipientCount: Optional[int] = None


class Template(_Base):
    """A reusable envelope template."""

    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class TemplateSummary(_Base):
    """Condensed template as returned in list pages."""

    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    documentCount: Optional[int] = None
    roleCount: Optional[int] = None
    fieldCount: Optional[int] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class EmbeddedSigningUrl(_Base):
    """Response from creating an embedded signing URL."""

    url: str
    expiresAt: Optional[datetime] = None


class ActionResult(_Base):
    """Response from the ``send`` / ``void`` envelope actions."""

    status: Optional[str] = None
    envelopeId: Optional[str] = None


class UpgradeResult(_Base):
    """Response from ``POST /api/v1/billing/upgrade``.

    Either ``checkout_url`` is set (a hosted checkout link to open), or
    ``status == 'updated'`` (the plan was changed without a payment step).
    """

    checkout_url: Optional[str] = None
    status: Optional[str] = None


class Page(_Base):
    """A cursor-paginated list response.

    ``data`` holds the raw item dicts; the resource methods wrap each item in
    the appropriate summary model. Use ``next_cursor`` with the ``cursor``
    argument to fetch the next page when ``has_more`` is ``True``.
    """

    data: List[Any] = []
    has_more: bool = False
    next_cursor: Optional[str] = None
