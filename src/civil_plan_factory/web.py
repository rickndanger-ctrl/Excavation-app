"""Local HTTP front door for Model Studio."""

import base64
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import time
from typing import Any
from urllib.parse import unquote, urlparse
import uuid

from .studio import StudioWorkspace


STATIC_ROOT = Path(__file__).with_name("studio_web")
STATIC_FILES = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/observability.css": ("observability.css", "text/css; charset=utf-8"),
}


class StudioHTTPServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], workspace: StudioWorkspace):
        self.workspace = workspace
        self.operations: dict[str, dict[str, Any]] = {}
        self.operations_lock = threading.Lock()
        super().__init__(address, StudioRequestHandler)

    def start_run(self, slug: str) -> dict[str, Any]:
        operation_id = uuid.uuid4().hex
        operation = {
            "operation_id": operation_id,
            "project_slug": slug,
            "status": "queued",
            "stage": "queued",
            "progress_percent": 0,
            "started_at": None,
            "elapsed_seconds": 0.0,
            "_queued_monotonic": time.monotonic(),
        }
        with self.operations_lock:
            self.operations[operation_id] = operation

        def work() -> None:
            try:
                with self.operations_lock:
                    operation.update(
                        status="running",
                        stage="canonical_validation_and_build",
                        progress_percent=25,
                        started_at=operation.get("started_at") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    )
                result = self.workspace.run_project(slug)
                with self.operations_lock:
                    operation.update(
                        status="complete",
                        stage=result["stage"],
                        progress_percent=100,
                        result=result,
                        elapsed_seconds=round(time.monotonic() - operation["_queued_monotonic"], 3),
                    )
            except Exception as error:
                with self.operations_lock:
                    operation.update(
                        status="failed",
                        stage="failed",
                        progress_percent=100,
                        error=f"{type(error).__name__}: {error}",
                        elapsed_seconds=round(time.monotonic() - operation["_queued_monotonic"], 3),
                    )

        threading.Thread(target=work, name=f"model-studio-{operation_id[:8]}", daemon=True).start()
        return dict(operation)

    def operation(self, operation_id: str) -> dict[str, Any] | None:
        with self.operations_lock:
            operation = self.operations.get(operation_id)
            if operation is None:
                return None
            result = {key: value for key, value in operation.items() if not key.startswith("_")}
            if result["status"] in {"queued", "running"}:
                result["elapsed_seconds"] = round(
                    time.monotonic() - operation["_queued_monotonic"], 3
                )
            return result


class StudioRequestHandler(BaseHTTPRequestHandler):
    server: StudioHTTPServer

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status: int, message: str) -> None:
        self._send_json(status, {"error": message})

    def _payload(self) -> dict[str, Any]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ValueError("Invalid Content-Length") from error
        if length > 150 * 1024 * 1024:
            raise ValueError("Request exceeds the 150 MB local intake limit")
        value = json.loads(self.rfile.read(length) or b"{}")
        if not isinstance(value, dict):
            raise ValueError("JSON request body must be an object")
        return value

    def do_GET(self) -> None:
        path = unquote(urlparse(self.path).path)
        if path in STATIC_FILES:
            filename, content_type = STATIC_FILES[path]
            body = (STATIC_ROOT / filename).read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)
            return
        parts = [part for part in path.split("/") if part]
        try:
            if parts == ["api", "health"]:
                self._send_json(HTTPStatus.OK, {
                    "status": "ok",
                    "service": "model-studio",
                    "disclaimer": "FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION",
                    "repository": str(self.server.workspace.repository),
                })
                return
            if parts == ["api", "projects"]:
                self._send_json(HTTPStatus.OK, self.server.workspace.list_projects())
                return
            if len(parts) == 3 and parts[:2] == ["api", "projects"]:
                self._send_json(HTTPStatus.OK, self.server.workspace.project_detail(parts[2]))
                return
            if len(parts) == 3 and parts[:2] == ["api", "operations"]:
                operation = self.server.operation(parts[2])
                if operation is None:
                    self._error(HTTPStatus.NOT_FOUND, "Unknown operation")
                else:
                    self._send_json(HTTPStatus.OK, operation)
                return
        except FileNotFoundError as error:
            self._error(HTTPStatus.NOT_FOUND, str(error))
            return
        except (OSError, ValueError) as error:
            self._error(HTTPStatus.BAD_REQUEST, str(error))
            return
        self._error(HTTPStatus.NOT_FOUND, "Unknown route")

    def do_POST(self) -> None:
        path = unquote(urlparse(self.path).path)
        parts = [part for part in path.split("/") if part]
        try:
            payload = self._payload()
            if parts == ["api", "projects"]:
                result = self.server.workspace.create_project(
                    str(payload.get("name", "")),
                    str(payload["slug"]) if payload.get("slug") else None,
                )
                self._send_json(HTTPStatus.CREATED, result)
                return
            if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "inputs":
                try:
                    content = base64.b64decode(str(payload.get("content_base64", "")), validate=True)
                except ValueError as error:
                    raise ValueError("content_base64 must be valid base64") from error
                result = self.server.workspace.add_input(parts[2], str(payload.get("filename", "")), content)
                self._send_json(HTTPStatus.CREATED, result)
                return
            if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "reviews":
                result = self.server.workspace.review_issue(
                    parts[2],
                    str(payload.get("issue_key", "")),
                    reviewer=str(payload.get("reviewer", "")),
                    note=str(payload.get("note", "")),
                )
                self._send_json(HTTPStatus.CREATED, result)
                return
            if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "touches":
                result = self.server.workspace.record_operator_touch(
                    parts[2],
                    activity=str(payload.get("activity", "")),
                    minutes=payload.get("minutes", 0),
                    note=str(payload.get("note", "")),
                    result_classification=str(payload.get("result_classification", "not_assessed")),
                )
                self._send_json(HTTPStatus.CREATED, result)
                return
            if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "runs":
                self.server.workspace._project_file(parts[2])
                self._send_json(HTTPStatus.ACCEPTED, self.server.start_run(parts[2]))
                return
            if len(parts) == 4 and parts[:2] == ["api", "projects"] and parts[3] == "publish":
                result = self.server.workspace.publish(parts[2], str(payload.get("run_id", "")))
                self._send_json(HTTPStatus.CREATED, result)
                return
        except FileNotFoundError as error:
            self._error(HTTPStatus.NOT_FOUND, str(error))
            return
        except FileExistsError as error:
            self._error(HTTPStatus.CONFLICT, str(error))
            return
        except (KeyError, OSError, ValueError, json.JSONDecodeError) as error:
            status = HTTPStatus.CONFLICT if parts and parts[-1] == "publish" else HTTPStatus.BAD_REQUEST
            self._error(status, str(error))
            return
        self._error(HTTPStatus.NOT_FOUND, "Unknown route")


def create_server(
    workspace: StudioWorkspace,
    *,
    host: str = "127.0.0.1",
    port: int = 8765,
) -> StudioHTTPServer:
    return StudioHTTPServer((host, port), workspace)
