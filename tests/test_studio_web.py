import base64
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from contextlib import redirect_stdout
from io import StringIO
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from civil_plan_factory.studio import StudioWorkspace
from civil_plan_factory.validation import DISCLAIMER
from civil_plan_factory.web import create_server
from civil_plan_factory.cli import main


class ModelStudioWebTests(unittest.TestCase):
    def test_local_web_console_module_exists(self):
        self.assertIsNotNone(importlib.util.find_spec("civil_plan_factory.web"))

    def test_cli_exposes_the_local_console_entry_point(self):
        output = StringIO()
        with self.assertRaises(SystemExit) as stopped, redirect_stdout(output):
            main(["--help"])

        self.assertEqual(0, stopped.exception.code)
        self.assertIn("serve", output.getvalue())

    def setUp(self):
        self.repository_temp = tempfile.TemporaryDirectory()
        self.state_temp = tempfile.TemporaryDirectory()
        repository = Path(self.repository_temp.name)
        (repository / "projects").mkdir()
        self.workspace = StudioWorkspace(repository, state_root=Path(self.state_temp.name))
        self.server = create_server(self.workspace, host="127.0.0.1", port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.repository_temp.cleanup()
        self.state_temp.cleanup()

    def request(self, path, *, method="GET", payload=None):
        data = None if payload is None else json.dumps(payload).encode()
        request = Request(
            self.base_url + path,
            data=data,
            method=method,
            headers={"Content-Type": "application/json"} if data else {},
        )
        with urlopen(request, timeout=5) as response:
            content_type = response.headers.get_content_type()
            body = response.read()
            return response.status, json.loads(body) if content_type == "application/json" else body.decode()

    def test_console_shell_exposes_the_fail_closed_operator_workflow(self):
        status, html = self.request("/")
        _, javascript = self.request("/app.js")
        _, stylesheet = self.request("/styles.css")

        self.assertEqual(200, status)
        self.assertIn(DISCLAIMER, html)
        self.assertIn("Publication readiness", html)
        self.assertIn('id="readiness-groups"', html)
        self.assertIn("Run canonical pipeline", html)
        self.assertIn("data:image/svg+xml", html)
        self.assertIn("/api/projects", javascript)
        self.assertIn("readiness_inventory", javascript)
        self.assertIn("current_run", javascript)
        self.assertIn("--danger", stylesheet)
        self.assertIn("[hidden]", stylesheet)

    def test_health_endpoint_proves_the_real_workspace_is_ready(self):
        status, health = self.request("/api/health")

        self.assertEqual(200, status)
        self.assertEqual("ok", health["status"])
        self.assertEqual("model-studio", health["service"])
        self.assertEqual(DISCLAIMER, health["disclaimer"])
        self.assertEqual(str(self.server.workspace.repository), health["repository"])

    def test_project_intake_run_and_review_are_operable_through_http(self):
        _, created = self.request(
            "/api/projects", method="POST", payload={"name": "Oak Street Intake", "slug": "oak-street"}
        )
        plan = b"%PDF-1.7\noperator intake\n%%EOF\n"
        _, source = self.request(
            "/api/projects/oak-street/inputs",
            method="POST",
            payload={"filename": "plans.pdf", "content_base64": base64.b64encode(plan).decode()},
        )
        _, operation = self.request("/api/projects/oak-street/runs", method="POST", payload={})

        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            _, progress = self.request(f"/api/operations/{operation['operation_id']}")
            if progress["status"] in {"complete", "failed"}:
                break
            time.sleep(0.02)
        else:
            self.fail("pipeline operation did not finish")

        _, detail = self.request("/api/projects/oak-street")
        issue = detail["issues"][0]
        _, review = self.request(
            "/api/projects/oak-street/reviews",
            method="POST",
            payload={"issue_key": issue["key"], "reviewer": "R. Operator", "note": "Waiting on CRS."},
        )

        self.assertEqual("oak-street", created["slug"])
        self.assertEqual("unknown", source["provenance_status"])
        self.assertEqual("complete", progress["status"])
        self.assertEqual("invalid", progress["result"]["status"])
        self.assertEqual("blocked", progress["result"]["publication_readiness"])
        self.assertEqual("reviewed_not_cleared", review["status"])

    def test_operator_sees_latest_completion_when_content_ids_sort_the_other_way(self):
        self.request(
            "/api/projects", method="POST", payload={"name": "Run Ordering", "slug": "run-ordering"}
        )
        runs = Path(self.state_temp.name) / "runs/run-ordering"
        fixtures = (
            ("z-old-content-id", "2026-08-21T10:00:00Z", "invalid"),
            ("a-new-content-id", "2026-08-21T11:00:00Z", "valid"),
        )
        current_fingerprint = self.workspace._fingerprint("run-ordering")
        for run_id, completed_at, status in fixtures:
            path = runs / run_id
            path.mkdir(parents=True)
            (path / "run.json").write_text(json.dumps({
                "run_id": run_id,
                "started_at": completed_at,
                "completed_at": completed_at,
                "status": status,
                "publication_readiness": "ready" if status == "valid" else "blocked",
                "project_fingerprint": current_fingerprint,
            }))

        _, detail = self.request("/api/projects/run-ordering")

        self.assertEqual("a-new-content-id", detail["runs"][0]["run_id"])
        self.assertEqual("valid", detail["runs"][0]["status"])
        self.assertEqual("z-old-content-id", detail["runs"][1]["run_id"])
        self.assertEqual("invalid", detail["runs"][1]["status"])
        self.assertEqual("a-new-content-id", detail["current_run"]["run_id"])

    def test_unknown_routes_and_failed_publish_return_json_errors(self):
        with self.assertRaises(HTTPError) as missing:
            self.request("/api/projects/missing")
        self.assertEqual(404, missing.exception.code)
        missing.exception.close()

        with self.assertRaises(HTTPError) as blocked:
            self.request(
                "/api/projects/oak-street/publish",
                method="POST",
                payload={"run_id": "missing"},
            )
        self.assertEqual(409, blocked.exception.code)
        blocked.exception.close()


if __name__ == "__main__":
    unittest.main()
