import importlib.util
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from civil_plan_factory.studio import StudioWorkspace
from civil_plan_factory.validation import DISCLAIMER


REPOSITORY = Path(__file__).resolve().parents[1]


class ModelStudioModuleTests(unittest.TestCase):
    def test_local_operator_workspace_module_exists(self):
        spec = importlib.util.find_spec("civil_plan_factory.studio")
        self.assertIsNotNone(
            spec,
            "Model Studio needs a local workspace layer instead of duplicating pipeline logic in a UI",
        )

    def test_lists_real_projects_with_validation_and_provenance_summary(self):
        with tempfile.TemporaryDirectory() as state:
            workspace = StudioWorkspace(REPOSITORY, state_root=Path(state))
            projects = workspace.list_projects()

        hilyard = next(project for project in projects if project["slug"] == "hilyard")
        self.assertEqual("hilyard-apartment-test", hilyard["project_id"])
        self.assertEqual("valid", hilyard["validation_status"])
        self.assertGreater(hilyard["provenance"]["reviewed_assumption"], 0)
        self.assertGreater(hilyard["provenance"]["unknown"], 0)
        self.assertEqual(DISCLAIMER, hilyard["disclaimer"])

    def test_creates_an_explicitly_incomplete_project_without_inventing_inputs(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))

            created = workspace.create_project("Oak Street Intake", "oak-street")
            detail = workspace.project_detail("oak-street")

            self.assertEqual("oak-street", created["slug"])
            self.assertEqual("invalid", detail["validation_status"])
            self.assertIn("crs.missing", {issue["code"] for issue in detail["issues"]})
            project = json.loads((root / "projects/oak-street/project.json").read_text())
            self.assertEqual(DISCLAIMER, project["project"]["disclaimer"])
            self.assertEqual([], project["features"]["points"])
            self.assertEqual([], project["contract_coverage"])

    def test_intake_checksum_locks_plan_bytes_and_never_claims_their_content(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            workspace.create_project("Oak Street Intake", "oak-street")
            plan_bytes = b"%PDF-1.7\nfictional operator input\n%%EOF\n"

            record = workspace.add_input("oak-street", "oak plans.pdf", plan_bytes)
            duplicate = workspace.add_input("oak-street", "oak plans.pdf", plan_bytes)

            self.assertEqual(record, duplicate)
            self.assertEqual(hashlib.sha256(plan_bytes).hexdigest(), record["sha256"])
            self.assertEqual("unknown", record["provenance_status"])
            self.assertEqual([], record["supports"])
            self.assertEqual(plan_bytes, Path(record["path"]).read_bytes())
            ledger = json.loads((root / "projects/oak-street/sources.lock.json").read_text())
            self.assertEqual(1, len(ledger["sources"]))

    def test_review_notes_are_auditable_but_cannot_clear_a_validation_gate(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            workspace.create_project("Oak Street Intake", "oak-street")
            issue = workspace.project_detail("oak-street")["issues"][0]

            review = workspace.review_issue(
                "oak-street", issue["key"], reviewer="R. Operator", note="Need source CRS from surveyor."
            )
            detail = workspace.project_detail("oak-street")

            self.assertEqual("reviewed_not_cleared", review["status"])
            self.assertEqual("reviewed_not_cleared", detail["issues"][0]["review"]["status"])
            with self.assertRaisesRegex(ValueError, "validated run"):
                workspace.publish("oak-street", "not-a-run")

    def test_incomplete_intake_exposes_grouped_actionable_readiness_inventory(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            workspace.create_project("Phoenix Public Plan Intake", "phoenix-intake")

            detail = workspace.project_detail("phoenix-intake")

            inventory = detail["readiness_inventory"]
            self.assertEqual("blocked", inventory["status"])
            self.assertEqual(detail["issue_count"], inventory["blocker_count"])
            self.assertIn("spatial_basis", inventory["groups"])
            self.assertIn("system_coverage", inventory["groups"])
            self.assertTrue(all(group["next_action"] for group in inventory["groups"].values()))

    def test_workflow_observation_exposes_evidence_decisions_blockers_outputs_and_timing(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            workspace.create_project("Observable Intake", "observable-intake")
            source = workspace.add_input(
                "observable-intake", "source-plan.pdf", b"%PDF-1.7\nobservable source\n%%EOF\n"
            )
            touch = workspace.record_operator_touch(
                "observable-intake",
                activity="source_intake",
                minutes=2.5,
                note="Verified filename and checksum against the intake record.",
                result_classification="valid_fail_closed_incomplete_plans",
            )
            run = workspace.run_project("observable-intake")

            detail = workspace.project_detail("observable-intake")
            observation = detail["workflow_observation"]
            self.assertEqual("review_gates", observation["stage"])
            self.assertIn("authoritative model", observation["current_action"])
            self.assertEqual("draft-intake-0", observation["job_control"]["revision"])
            self.assertEqual(1, observation["inputs"]["plan_set_count"])
            self.assertEqual(source["sha256"], observation["inputs"]["evidence"][0]["sha256"])
            self.assertEqual("unknown", observation["inputs"]["evidence"][0]["provenance_status"])
            self.assertGreater(observation["blockers"]["blocker_count"], 0)
            self.assertIn("validation-report.json", observation["outputs"]["artifacts"])
            self.assertEqual(run["run_id"], observation["outputs"]["run_id"])
            self.assertGreaterEqual(observation["timing"]["automated_seconds"], 0)
            self.assertEqual(150, observation["timing"]["manual_seconds"])
            self.assertEqual(touch["touch_id"], observation["operator_touches"][0]["touch_id"])
            self.assertEqual(
                "valid_fail_closed_incomplete_plans", observation["result_classification"]
            )

    def test_operator_touch_rejects_invalid_time_and_classification(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            workspace.create_project("Touch Guard", "touch-guard")

            with self.assertRaisesRegex(ValueError, "positive"):
                workspace.record_operator_touch(
                    "touch-guard", activity="source_intake", minutes=0, note="No time"
                )
            with self.assertRaisesRegex(ValueError, "classification"):
                workspace.record_operator_touch(
                    "touch-guard",
                    activity="source_intake",
                    minutes=1,
                    note="Bad classification",
                    result_classification="green_enough",
                )

    def test_runs_are_ordered_by_completion_time_not_content_address(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            workspace.create_project("Run Ordering", "run-ordering")
            runs = Path(state) / "runs/run-ordering"
            for run_id, completed_at in (
                ("z-old-content-id", "2026-08-21T10:00:00Z"),
                ("a-new-content-id", "2026-08-21T11:00:00Z"),
            ):
                path = runs / run_id
                path.mkdir(parents=True)
                (path / "run.json").write_text(json.dumps({
                    "run_id": run_id,
                    "completed_at": completed_at,
                    "started_at": completed_at,
                }))

            listed = workspace.list_runs("run-ordering")

            self.assertEqual(["a-new-content-id", "z-old-content-id"], [row["run_id"] for row in listed])

    def test_completed_run_becomes_stale_when_authoritative_inputs_change(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            workspace.create_project("Stale Run Guard", "stale-run")
            completed = workspace.run_project("stale-run")

            before = workspace.project_detail("stale-run")
            workspace.add_input("stale-run", "new-plan.pdf", b"%PDF-1.7\nchanged input\n%%EOF\n")
            after = workspace.project_detail("stale-run")

            self.assertEqual(completed["run_id"], before["current_run"]["run_id"])
            self.assertTrue(before["runs"][0]["is_current"])
            self.assertIsNone(after["current_run"])
            self.assertFalse(after["runs"][0]["is_current"])

    def test_real_hilyard_run_publishes_a_content_addressed_field_map_handoff(self):
        with tempfile.TemporaryDirectory() as state:
            workspace = StudioWorkspace(REPOSITORY, state_root=Path(state))
            run = workspace.run_project("hilyard")
            publication = workspace.publish("hilyard", run["run_id"])
            repeated = workspace.publish("hilyard", run["run_id"])

            self.assertEqual("valid", run["status"])
            self.assertEqual("ready", run["publication_readiness"])
            self.assertEqual(publication, repeated)
            self.assertRegex(publication["publication_id"], r"^[0-9a-f]{64}$")
            import_file = Path(publication["import_file"])
            self.assertTrue(import_file.is_file())
            semantic = json.loads(import_file.read_text())
            self.assertEqual("excavation-field-map.jobsite-package/v0.1.0", semantic["schema_version"])
            self.assertEqual(DISCLAIMER, semantic["disclaimer"])
            handoff = json.loads(Path(publication["handoff_manifest"]).read_text())
            self.assertEqual(DISCLAIMER, handoff["disclaimer"])
            self.assertEqual(publication["publication_id"], handoff["publication_id"])
            self.assertEqual(hashlib.sha256(import_file.read_bytes()).hexdigest(), handoff["artifacts"]["semantic-manifest.json"])

            import_file.write_text("{}\n")
            with self.assertRaisesRegex(ValueError, "Immutable publication"):
                workspace.publish("hilyard", run["run_id"])


if __name__ == "__main__":
    unittest.main()
