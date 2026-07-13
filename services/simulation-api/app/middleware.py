"""Privacy-safe ASGI middleware."""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Awaitable
from typing import Any, Callable, Dict, List, Optional
from uuid import uuid4

ASGIApp = Callable[
    [Dict[str, Any], Callable[..., Awaitable[Dict[str, Any]]], Callable[..., Awaitable[None]]],
    Awaitable[None],
]


class RequestSizeLimitMiddleware:
    """Reject oversized POST bodies before validation and never log their content."""

    def __init__(self, app: ASGIApp, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Dict[str, Any], receive: Callable[..., Any], send: Callable[..., Any]) -> None:
        if scope["type"] != "http" or scope.get("method") not in {"POST", "PUT", "PATCH"}:
            await self.app(scope, receive, send)
            return

        request_id = scope.setdefault("state", {}).setdefault("request_id", str(uuid4()))
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        content_length = headers.get(b"content-length")
        if content_length is not None:
            try:
                if int(content_length) > self.max_bytes:
                    await self._reject(send, request_id)
                    return
            except ValueError:
                await self._reject(send, request_id)
                return

        chunks: List[bytes] = []
        total = 0
        more_body = True
        while more_body:
            message = await receive()
            if message.get("type") == "http.disconnect":
                return
            body = message.get("body", b"")
            total += len(body)
            if total > self.max_bytes:
                await self._reject(send, request_id)
                return
            chunks.append(body)
            more_body = bool(message.get("more_body", False))

        replayed = False

        async def replay_receive() -> Dict[str, Any]:
            nonlocal replayed
            if replayed:
                return {"type": "http.request", "body": b"", "more_body": False}
            replayed = True
            return {"type": "http.request", "body": b"".join(chunks), "more_body": False}

        await self.app(scope, replay_receive, send)

    @staticmethod
    async def _reject(send: Callable[..., Any], request_id: str) -> None:
        body = json.dumps(
            {
                "code": "incomplete_household",
                "message": "La solicitud supera el tamaño máximo permitido.",
                "requestId": request_id,
            },
            separators=(",", ":"),
        ).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json; charset=utf-8"),
                    (b"content-length", str(len(body)).encode("ascii")),
                    (b"cache-control", b"no-store"),
                    (b"x-request-id", request_id.encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})


class PrivacySafeAccessLogMiddleware:
    """Log coarse operational metadata, never bodies, query strings, or responses."""

    def __init__(self, app: ASGIApp, logger: Optional[logging.Logger] = None):
        self.app = app
        self.logger = logger or logging.getLogger("cifra_civica.access")

    async def __call__(self, scope: Dict[str, Any], receive: Callable[..., Any], send: Callable[..., Any]) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = scope.setdefault("state", {}).setdefault("request_id", str(uuid4()))
        started = time.monotonic()
        status_code = 500

        async def safe_send(message: Dict[str, Any]) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode("ascii")))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, safe_send)
        finally:
            event = {
                "event": "http_request_completed",
                "requestId": request_id,
                "method": scope.get("method", ""),
                "path": scope.get("path", ""),
                "statusCode": status_code,
                "durationMs": round((time.monotonic() - started) * 1000, 2),
            }
            self.logger.info(json.dumps(event, separators=(",", ":"), ensure_ascii=True))
