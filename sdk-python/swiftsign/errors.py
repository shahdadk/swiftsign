"""Error types for the SwiftSign SDK."""

from __future__ import annotations

from typing import Any, Optional


class SwiftSignError(Exception):
    """Raised on any non-2xx response from the SwiftSign API.

    The SwiftSign API returns RFC 9457 ``application/problem+json`` bodies of the
    shape ``{type, title, status, code, detail, request_id}``. A few legacy
    routes return a plain ``{"error": "..."}`` body instead; both are normalized
    here so callers can rely on the same attributes.

    Attributes:
        code: Machine-readable error code (e.g. ``"validation_error"``), or
            ``None`` if the response did not carry one.
        status: HTTP status code of the response.
        request_id: Server-issued request id, useful for support, or ``None``.
        detail: Human-readable explanation of the error, or ``None``.
        title: Short summary of the problem type, or ``None``.
        problem: The raw parsed problem/error dict from the response body.
    """

    def __init__(
        self,
        message: str,
        *,
        status: int,
        code: Optional[str] = None,
        request_id: Optional[str] = None,
        detail: Optional[str] = None,
        title: Optional[str] = None,
        problem: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.request_id = request_id
        self.detail = detail
        self.title = title
        self.problem: dict[str, Any] = problem or {}

    @classmethod
    def from_response(cls, status: int, body: Any) -> "SwiftSignError":
        """Build a :class:`SwiftSignError` from an HTTP status and parsed body."""
        problem: dict[str, Any] = body if isinstance(body, dict) else {}
        code = problem.get("code")
        request_id = problem.get("request_id")
        detail = problem.get("detail")
        title = problem.get("title")
        # Legacy/plain routes use {"error": "..."} instead of problem+json.
        message = (
            detail
            or title
            or problem.get("error")
            or f"SwiftSign API request failed with status {status}"
        )
        return cls(
            message,
            status=status,
            code=code,
            request_id=request_id,
            detail=detail,
            title=title,
            problem=problem,
        )

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        base = super().__str__()
        parts = [f"status={self.status}"]
        if self.code:
            parts.append(f"code={self.code}")
        if self.request_id:
            parts.append(f"request_id={self.request_id}")
        return f"{base} ({', '.join(parts)})"
