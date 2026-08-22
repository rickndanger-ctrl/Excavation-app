import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from contextlib import redirect_stdout
from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from civil_plan_factory.studio import StudioWorkspace
from civil_plan_factory.reviewed_sources import adapter_for_checksum
from civil_plan_factory.validation import DISCLAIMER
from civil_plan_factory.web import create_server
from civil_plan_factory.cli import main


READING_SHA256 = "835e28d8d981b4c0a0c5840e006c4cc19f259fc7fcb218ddc744bfec97da97d1"
TEST_READING_BYTES = b"%PDF-1.7\nself-contained HTTP reviewed-source fixture\n%%EOF\n"
TEST_READING_SHA256 = hashlib.sha256(TEST_READING_BYTES).hexdigest()


def http_test_reading_adapter():
    production = adapter_for_checksum(READING_SHA256)
    if production is None:  # pragma: no cover - direct production invariant
        raise AssertionError("Production Reading adapter is not registered")

    def build(intake_project, source):
        project, sources, decisions = production.build(intake_project, source)
        project["reviewed_source_adapter"]["source_sha256"] = TEST_READING_SHA256
        return project, sources, decisions

    return SimpleNamespace(
        adapter_id=production.adapter_id,
        title=production.title,
        source_sha256=TEST_READING_SHA256,
        build=build,
    )


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
        self.assertIn("Author reviewed model", html)
        self.assertIn('id="author-reviewed-model"', html)
        self.assertIn("data:image/svg+xml", html)
        self.assertIn("/api/projects", javascript)
        self.assertIn("readiness_inventory", javascript)
        self.assertIn("current_run", javascript)
        self.assertIn("workflow_observation", javascript)
        self.assertIn('id="current-action"', html)
        self.assertIn('id="operator-touch-form"', html)
        self.assertIn('id="evidence-list"', html)
        self.assertIn("/touches", javascript)
        self.assertIn("/author", javascript)
        self.assertIn("offline_import_file", javascript)
        self.assertIn("function setProjectOperationBusy", javascript)
        self.assertIn("function reviewedAuthoringAllowsRun", javascript)
        self.assertIn("const authoringReady=reviewedAuthoringAllowsRun()", javascript)
        self.assertIn("disabled=busy||!authoringReady", javascript)
        self.assertIn("if(!reviewedAuthoringAllowsRun())", javascript)
        self.assertIn("if(state.operation)", javascript)
        self.assertNotIn(
            "event.currentTarget.reset()",
            javascript,
            "async form handlers must retain the form before the event currentTarget is cleared",
        )
        self.assertIn("--danger", stylesheet)
        self.assertIn("[hidden]", stylesheet)

    def test_health_endpoint_proves_the_real_workspace_is_ready(self):
        status, health = self.request("/api/health")

        self.assertEqual(200, status)
        self.assertEqual("ok", health["status"])
        self.assertEqual("model-studio", health["service"])
        self.assertEqual(DISCLAIMER, health["disclaimer"])
        self.assertEqual(str(self.server.workspace.repository), health["repository"])

    def test_missing_source_ledger_stays_visible_as_an_invalid_project_over_http(self):
        self.request(
            "/api/projects",
            method="POST",
            payload={"name": "Missing Source Ledger", "slug": "missing-source-ledger"},
        )
        (
            self.workspace.repository
            / "projects/missing-source-ledger/sources.lock.json"
        ).unlink()

        status, detail = self.request("/api/projects/missing-source-ledger")
        list_status, projects = self.request("/api/projects")

        self.assertEqual(200, status)
        self.assertEqual(200, list_status)
        self.assertEqual("invalid", detail["validation_status"])
        self.assertIn("bundle.load_failed", {
            issue["code"] for issue in detail["issues"]
        })
        self.assertEqual("unavailable", detail["reviewed_authoring"]["status"])
        self.assertIn(
            "source ledger", detail["reviewed_authoring"]["reason"].lower()
        )
        self.assertIn(
            "missing-source-ledger", {project["slug"] for project in projects}
        )

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
        self.assertIn("elapsed_seconds", progress)

    def test_http_rejects_overlapping_project_operations_until_first_finishes(self):
        self.request(
            "/api/projects",
            method="POST",
            payload={"name": "Serialized Operations", "slug": "serialized-operations"},
        )
        run_entered = threading.Event()
        release_run = threading.Event()

        def blocking_run(slug):
            self.assertEqual("serialized-operations", slug)
            run_entered.set()
            if not release_run.wait(timeout=3):
                raise TimeoutError("test did not release canonical run")
            return {
                "run_id": "serialized-run",
                "stage": "blocked",
                "status": "invalid",
                "publication_readiness": "blocked",
            }

        with patch.object(self.workspace, "run_project", side_effect=blocking_run):
            status, first = self.request(
                "/api/projects/serialized-operations/runs",
                method="POST",
                payload={},
            )
            self.assertEqual(202, status)
            self.assertTrue(run_entered.wait(timeout=2))

            with self.assertRaises(HTTPError) as conflict:
                self.request(
                    "/api/projects/serialized-operations/author",
                    method="POST",
                    payload={},
                )
            self.assertEqual(409, conflict.exception.code)
            error = json.loads(conflict.exception.read())
            self.assertIn("already has an active operation", error["error"])

            release_run.set()
            deadline = time.monotonic() + 3
            while time.monotonic() < deadline:
                _, progress = self.request(
                    f"/api/operations/{first['operation_id']}"
                )
                if progress["status"] in {"complete", "failed"}:
                    break
                time.sleep(0.02)
            else:
                self.fail("first project operation did not finish")

            accepted, _ = self.request(
                "/api/projects/serialized-operations/runs",
                method="POST",
                payload={},
            )

        self.assertEqual("complete", progress["status"])
        self.assertEqual(202, accepted)

    def test_reviewed_reading_source_authors_through_an_observable_http_operation(self):
        test_adapter = http_test_reading_adapter()

        def lookup(checksum):
            if checksum == TEST_READING_SHA256:
                return test_adapter
            return adapter_for_checksum(checksum)

        adapter_patch = patch(
            "civil_plan_factory.studio.adapter_for_checksum", side_effect=lookup
        )
        adapter_patch.start()
        self.addCleanup(adapter_patch.stop)
        _, created = self.request(
            "/api/projects",
            method="POST",
            payload={"name": "Reading Public Library Demo", "slug": "reading-demo"},
        )
        plan = TEST_READING_BYTES
        self.request(
            "/api/projects/reading-demo/inputs",
            method="POST",
            payload={
                "filename": "25020-RPL_Bid_Drawings_2025_07_11.pdf",
                "content_base64": base64.b64encode(plan).decode(),
            },
        )

        _, before = self.request("/api/projects/reading-demo")
        status, operation = self.request(
            "/api/projects/reading-demo/author", method="POST", payload={}
        )
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            _, progress = self.request(f"/api/operations/{operation['operation_id']}")
            if progress["status"] in {"complete", "failed"}:
                break
            time.sleep(0.02)
        else:
            self.fail("reviewed authoring operation did not finish")
        _, after = self.request("/api/projects/reading-demo")

        _, run_operation = self.request(
            "/api/projects/reading-demo/runs", method="POST", payload={}
        )
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            _, run_progress = self.request(
                f"/api/operations/{run_operation['operation_id']}"
            )
            if run_progress["status"] in {"complete", "failed"}:
                break
            time.sleep(0.02)
        else:
            self.fail("reviewed Reading pipeline operation did not finish")
        run_semantic = (
            Path(self.state_temp.name)
            / "runs/reading-demo"
            / run_progress["result"]["run_id"]
            / "semantic-manifest.json"
        )
        original_run_semantic = run_semantic.read_bytes()
        run_semantic.write_text("{}\n")
        _, corrupt_run_detail = self.request("/api/projects/reading-demo")
        self.assertEqual(
            "blocked",
            corrupt_run_detail["current_run"]["publication_readiness"],
        )
        self.assertEqual(
            "corrupt", corrupt_run_detail["current_run"]["artifact_integrity"]
        )
        run_semantic.write_bytes(original_run_semantic)

        publish_status, publication = self.request(
            "/api/projects/reading-demo/publish",
            method="POST",
            payload={"run_id": run_progress["result"]["run_id"]},
        )
        envelope = json.loads(Path(publication["offline_import_file"]).read_text())

        self.assertEqual("reading-demo", created["slug"])
        self.assertEqual("available", before["reviewed_authoring"]["status"])
        self.assertEqual(202, status)
        self.assertEqual("complete", progress["status"])
        self.assertEqual("reviewed_source_authored", progress["stage"])
        self.assertEqual(58, progress["result"]["authored_feature_count"])
        self.assertEqual("complete", after["reviewed_authoring"]["status"])
        self.assertEqual("valid", after["validation_status"])
        self.assertEqual("complete", run_progress["status"])
        self.assertEqual("ready", run_progress["result"]["publication_readiness"])
        self.assertEqual(201, publish_status)
        self.assertEqual(
            "excavation-field-map.semantic-publication/v1",
            envelope["publication_schema"],
        )
        self.assertTrue(Path(publication["import_file"]).is_file())

        envelope["manifest_json"] = "{}"
        Path(publication["offline_import_file"]).write_text(
            json.dumps(envelope, indent=2, sort_keys=True) + "\n"
        )
        _, after_tamper = self.request("/api/projects/reading-demo")
        self.assertEqual(
            "publication_readiness",
            after_tamper["workflow_observation"]["stage"],
        )
        self.assertIsNone(
            after_tamper["workflow_observation"]["outputs"]["publication"]
        )

    def test_operator_touch_is_auditable_through_http(self):
        self.request(
            "/api/projects", method="POST", payload={"name": "Touch Log", "slug": "touch-log"}
        )

        status, touch = self.request(
            "/api/projects/touch-log/touches",
            method="POST",
            payload={
                "activity": "phone_check",
                "minutes": 3,
                "note": "Opened the imported package and toggled every expected layer.",
                "result_classification": "valid_fail_closed_incomplete_plans",
            },
        )
        _, detail = self.request("/api/projects/touch-log")

        self.assertEqual(201, status)
        self.assertEqual(DISCLAIMER, touch["disclaimer"])
        observation = detail["workflow_observation"]
        self.assertEqual(180, observation["timing"]["manual_seconds"])
        self.assertEqual(touch["touch_id"], observation["operator_touches"][0]["touch_id"])

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
            artifacts = {}
            if status == "valid":
                for name in (
                    "validation-report.json",
                    "parity-report.json",
                    "semantic-manifest.json",
                ):
                    artifact = path / name
                    artifact.write_text("{}\n")
                    artifacts[name] = hashlib.sha256(artifact.read_bytes()).hexdigest()
            (path / "run.json").write_text(json.dumps({
                "run_id": run_id,
                "started_at": completed_at,
                "completed_at": completed_at,
                "status": status,
                "publication_readiness": "ready" if status == "valid" else "blocked",
                "project_fingerprint": current_fingerprint,
                "artifacts": artifacts,
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
