import importlib.util
import copy
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from civil_plan_factory.custom_authoring import authored_bundle_sha256
from civil_plan_factory.studio import StudioWorkspace
from civil_plan_factory.validation import (
    CUSTOM_AUTHORING_MODE,
    CUSTOM_SEMANTIC_AUTHORING_CONTRACT,
    DISCLAIMER,
    custom_geometry_membership,
)


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
        observation = hilyard["workflow_observation"]
        self.assertGreater(observation["inputs"]["locked_source_count"], 0)
        self.assertEqual("not_assessed", observation["result_classification"])

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

    def test_invalid_custom_profile_does_not_poison_the_slug_before_retry(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            valid_profile = workspace.authoring_profiles()[0]["profile_id"]

            invalid_requests = (
                (
                    "missing-profile",
                    {"authoring_mode": CUSTOM_AUTHORING_MODE},
                    "profile_id",
                ),
                (
                    "unknown-profile",
                    {
                        "authoring_mode": CUSTOM_AUTHORING_MODE,
                        "profile_id": "not-registered",
                    },
                    "Unknown custom-plan",
                ),
                (
                    "unknown-mode",
                    {"authoring_mode": "found_plan_as_design"},
                    "Unknown project authoring mode",
                ),
            )
            for slug, options, message in invalid_requests:
                with self.subTest(slug=slug):
                    with self.assertRaisesRegex(ValueError, message):
                        workspace.create_project(
                            "Invalid Original", slug, **options
                        )
                    self.assertFalse((root / "projects" / slug).exists())

            created = workspace.create_project(
                "Retryable Original",
                "unknown-profile",
                authoring_mode=CUSTOM_AUTHORING_MODE,
                profile_id=valid_profile,
            )
            self.assertEqual("unknown-profile", created["slug"])

    def test_arbitrary_custom_mode_project_without_profile_is_fail_closed(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            workspace.create_project("Unbound Custom", "unbound-custom")
            project_path = root / "projects/unbound-custom/project.json"
            project = json.loads(project_path.read_text())
            project["project"]["authoring_mode"] = CUSTOM_AUTHORING_MODE
            project["authoring_contract"] = dict(CUSTOM_SEMANTIC_AUTHORING_CONTRACT)
            project_path.write_text(json.dumps(project, indent=2, sort_keys=True) + "\n")

            status = workspace.custom_authoring("unbound-custom")

            self.assertEqual("blocked", status["status"])
            self.assertEqual("profile_required", status["integrity_status"])
            with self.assertRaisesRegex(ValueError, "integrity-verified original custom plan"):
                workspace.run_project("unbound-custom")

    def test_any_custom_marker_keeps_a_project_in_the_fail_closed_custom_lane(self):
        marker_cases = {
            "authoring-contract": {
                "authoring_contract": dict(CUSTOM_SEMANTIC_AUTHORING_CONTRACT)
            },
            "profile": {"custom_plan_profile": {}},
            "geometry-receipt": {"geometry_origin_receipt": {}},
            "compiled-marker": {"custom_authoring": {}},
            "studio-marker": {"custom_plan_authoring": {}},
        }
        for case_name, marker in marker_cases.items():
            with self.subTest(marker=case_name), tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
                root = Path(repository)
                (root / "projects").mkdir()
                workspace = StudioWorkspace(root, state_root=Path(state))
                workspace.create_project("Claimed Custom", "claimed-custom")
                project_path = root / "projects/claimed-custom/project.json"
                project = json.loads(project_path.read_text())
                project.update(marker)
                project_path.write_text(
                    json.dumps(project, indent=2, sort_keys=True) + "\n"
                )

                status = workspace.custom_authoring("claimed-custom")

                self.assertNotEqual("not_custom_mode", status["integrity_status"])
                with self.assertRaisesRegex(
                    ValueError, "integrity-verified original custom plan"
                ):
                    workspace.run_project("claimed-custom")
                with self.assertRaisesRegex(ValueError, "custom-plan"):
                    workspace.author_reviewed_model("claimed-custom")

    def test_deleting_custom_mode_cannot_downgrade_an_authored_project_to_reviewed(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            profile = workspace.authoring_profiles()[0]
            workspace.create_project(
                "Mode Downgrade Guard",
                "mode-downgrade",
                authoring_mode=CUSTOM_AUTHORING_MODE,
                profile_id=profile["profile_id"],
            )
            workspace.save_design_brief("mode-downgrade", profile["default_brief"])
            workspace.author_custom_model("mode-downgrade")
            project_path = root / "projects/mode-downgrade/project.json"
            project = json.loads(project_path.read_text())
            del project["project"]["authoring_mode"]
            project_path.write_text(
                json.dumps(project, indent=2, sort_keys=True) + "\n"
            )

            status = workspace.custom_authoring("mode-downgrade")

            self.assertEqual("drifted", status["status"])
            with self.assertRaisesRegex(
                ValueError, "integrity-verified original custom plan"
            ):
                workspace.run_project("mode-downgrade")

    def test_self_signed_geometry_copy_does_not_match_the_trusted_profile_compilation(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            profile = workspace.authoring_profiles()[0]
            workspace.create_project(
                "Trusted Geometry",
                "trusted-geometry",
                authoring_mode=CUSTOM_AUTHORING_MODE,
                profile_id=profile["profile_id"],
            )
            workspace.save_design_brief("trusted-geometry", profile["default_brief"])
            workspace.author_custom_model("trusted-geometry")
            project_dir = root / "projects/trusted-geometry"
            project_path = project_dir / "project.json"
            project = json.loads(project_path.read_text())
            sources = json.loads((project_dir / "sources.lock.json").read_text())
            decisions = json.loads((project_dir / "decisions.json").read_text())
            reference = next(
                row
                for row in project["features"]["lines"]
                if row["phase_id"] == "phase-01-existing-control-erosion"
                and row["provenance"]["status"] == "reference-derived"
            )
            proposed = next(
                row
                for row in project["features"]["lines"]
                if row["phase_id"] != "phase-01-existing-control-erosion"
                and row["provenance"]["status"] == "reviewed_assumption"
            )
            proposed["coordinates"] = copy.deepcopy(reference["coordinates"])
            proposed["provenance"]["source_ids"] = copy.deepcopy(
                reference["provenance"]["source_ids"]
            )
            membership = custom_geometry_membership(
                project,
                project["geometry_origin_receipt"]["reference_context_phase_ids"],
            )
            project["geometry_origin_receipt"].update(membership)
            project["custom_plan_authoring"]["authored_bundle_sha256"] = (
                authored_bundle_sha256(project, sources, decisions)
            )
            project_path.write_text(
                json.dumps(project, indent=2, sort_keys=True) + "\n"
            )

            status = workspace.custom_authoring("trusted-geometry")

            self.assertEqual("drifted", status["status"])
            with self.assertRaisesRegex(
                ValueError, "integrity-verified original custom plan"
            ):
                workspace.run_project("trusted-geometry")

    def test_self_signed_source_or_decision_edits_do_not_match_trusted_compilation(self):
        mutations = {
            "recipe-source": lambda project, sources, decisions: sources["sources"][0].update(
                {"title": "Attacker-rewritten source title"}
            ),
            "design-decision": lambda project, sources, decisions: decisions["decisions"][0].update(
                {"rationale": "Attacker-rewritten design rationale"}
            ),
            "whole-project": lambda project, sources, decisions: project["project"].update(
                {"revision": "attacker-revision"}
            ),
        }
        for mutation_name, mutate in mutations.items():
            with self.subTest(mutation=mutation_name), tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
                root = Path(repository)
                (root / "projects").mkdir()
                workspace = StudioWorkspace(root, state_root=Path(state))
                profile = workspace.authoring_profiles()[0]
                workspace.create_project(
                    "Trusted Bundle",
                    "trusted-bundle",
                    authoring_mode=CUSTOM_AUTHORING_MODE,
                    profile_id=profile["profile_id"],
                )
                workspace.save_design_brief(
                    "trusted-bundle", profile["default_brief"]
                )
                workspace.author_custom_model("trusted-bundle")
                project_dir = root / "projects/trusted-bundle"
                project_path = project_dir / "project.json"
                sources_path = project_dir / "sources.lock.json"
                decisions_path = project_dir / "decisions.json"
                project = json.loads(project_path.read_text())
                sources = json.loads(sources_path.read_text())
                decisions = json.loads(decisions_path.read_text())
                mutate(project, sources, decisions)
                project["custom_plan_authoring"]["authored_bundle_sha256"] = (
                    authored_bundle_sha256(project, sources, decisions)
                )
                project_path.write_text(
                    json.dumps(project, indent=2, sort_keys=True) + "\n"
                )
                sources_path.write_text(
                    json.dumps(sources, indent=2, sort_keys=True) + "\n"
                )
                decisions_path.write_text(
                    json.dumps(decisions, indent=2, sort_keys=True) + "\n"
                )

                status = workspace.custom_authoring("trusted-bundle")

                self.assertEqual("drifted", status["status"])

    def test_repository_hilyard_uses_the_normal_verified_profile_path(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            shutil.copytree(REPOSITORY / "projects/hilyard", root / "projects/hilyard")
            workspace = StudioWorkspace(root, state_root=Path(state))

            verified = workspace.custom_authoring("hilyard")
            self.assertEqual("complete", verified["status"])
            self.assertEqual("verified", verified["integrity_status"])

            project_path = root / "projects/hilyard/project.json"
            project = json.loads(project_path.read_text())
            self.assertEqual(
                "hilyard_golden_apartment_v1",
                project["custom_plan_profile"]["profile_id"],
            )
            self.assertEqual(
                "complete", project["custom_plan_authoring"]["status"]
            )
            self.assertTrue((root / "projects/hilyard/design-brief.json").is_file())

    def test_custom_authoring_preserves_and_integrity_locks_optional_plan_bytes(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            profile = workspace.authoring_profiles()[0]
            workspace.create_project(
                "Original With Reference",
                "original-with-reference",
                authoring_mode=CUSTOM_AUTHORING_MODE,
                profile_id=profile["profile_id"],
            )
            plan_bytes = b"%PDF-1.7\noptional context only\n%%EOF\n"
            input_record = workspace.add_input(
                "original-with-reference", "context plan.pdf", plan_bytes
            )
            workspace.save_design_brief(
                "original-with-reference", profile["default_brief"]
            )

            authored = workspace.author_custom_model("original-with-reference")
            project_dir = root / "projects/original-with-reference"
            project = json.loads((project_dir / "project.json").read_text())
            ledger = json.loads((project_dir / "sources.lock.json").read_text())
            preserved = next(
                row for row in ledger["sources"] if row["id"] == input_record["id"]
            )

            self.assertEqual("complete", authored["status"])
            self.assertEqual("unknown", preserved["provenance_status"])
            self.assertEqual([], preserved["supports"])
            self.assertEqual(
                plan_bytes, (project_dir / preserved["citation"]).read_bytes()
            )
            authored_model = json.loads((project_dir / "project.json").read_text())
            self.assertFalse(
                any(
                    preserved["id"]
                    in feature.get("provenance", {}).get("source_ids", [])
                    for group in ("points", "lines", "polygons", "surfaces")
                    for feature in authored_model["features"][group]
                )
            )
            self.assertRegex(
                project["custom_plan_authoring"]["optional_input_bytes_sha256"],
                r"^[0-9a-f]{64}$",
            )
            self.assertEqual("complete", workspace.custom_authoring("original-with-reference")["status"])

            (project_dir / preserved["citation"]).write_bytes(
                b"%PDF-1.7\ntampered context\n%%EOF\n"
            )
            drifted = workspace.custom_authoring("original-with-reference")
            self.assertEqual("drifted", drifted["status"])
            with self.assertRaisesRegex(ValueError, "integrity-verified original custom plan"):
                workspace.run_project("original-with-reference")

    def test_custom_authoring_rejects_ambiguous_optional_input_citations(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            profile = workspace.authoring_profiles()[0]
            workspace.create_project(
                "Collision Guard",
                "collision-guard",
                authoring_mode=CUSTOM_AUTHORING_MODE,
                profile_id=profile["profile_id"],
            )
            workspace.add_input(
                "collision-guard",
                "context.pdf",
                b"%PDF-1.7\ncollision fixture\n%%EOF\n",
            )
            ledger_path = root / "projects/collision-guard/sources.lock.json"
            ledger = json.loads(ledger_path.read_text())
            duplicate = dict(ledger["sources"][0])
            duplicate["id"] = "input-ambiguous-duplicate"
            ledger["sources"].append(duplicate)
            ledger_path.write_text(json.dumps(ledger, indent=2, sort_keys=True) + "\n")
            workspace.save_design_brief("collision-guard", profile["default_brief"])
            project_path = root / "projects/collision-guard/project.json"
            before_project = project_path.read_bytes()
            before_ledger = ledger_path.read_bytes()

            with self.assertRaisesRegex(ValueError, "collision"):
                workspace.author_custom_model("collision-guard")
            self.assertEqual(before_project, project_path.read_bytes())
            self.assertEqual(before_ledger, ledger_path.read_bytes())

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
            source = ledger["sources"][0]
            self.assertEqual("project_bundle", source["citation_scope"])
            self.assertFalse(Path(source["citation"]).is_absolute())
            self.assertEqual(
                Path(record["path"]),
                (root / "projects/oak-street" / source["citation"]).resolve(),
            )

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

    def test_malformed_source_ledger_remains_an_actionable_invalid_project(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            workspace.create_project("Broken Source Ledger", "broken-source-ledger")
            ledger = root / "projects/broken-source-ledger/sources.lock.json"
            ledger.write_text("{malformed json\n")

            detail = workspace.project_detail("broken-source-ledger")
            listed = next(
                project
                for project in workspace.list_projects()
                if project["slug"] == "broken-source-ledger"
            )

            self.assertEqual("invalid", detail["validation_status"])
            self.assertIn("bundle.load_failed", {
                issue["code"] for issue in detail["issues"]
            })
            self.assertEqual("unavailable", detail["reviewed_authoring"]["status"])
            self.assertIn("source ledger", detail["reviewed_authoring"]["reason"].lower())
            self.assertEqual("invalid", listed["validation_status"])

    def test_missing_decision_ledger_remains_an_actionable_invalid_project(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            workspace.create_project("Missing Decisions", "missing-decisions")
            (root / "projects/missing-decisions/decisions.json").unlink()

            detail = workspace.project_detail("missing-decisions")

            self.assertEqual("invalid", detail["validation_status"])
            self.assertIn("bundle.load_failed", {
                issue["code"] for issue in detail["issues"]
            })
            self.assertEqual("unavailable", detail["reviewed_authoring"]["status"])
            self.assertIn(
                "decision ledger", detail["reviewed_authoring"]["reason"].lower()
            )

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
            self.assertIn("calibration-report.json", handoff["artifacts"])
            self.assertNotIn("calibration-benchmark.json", handoff["artifacts"])
            self.assertTrue(
                (Path(publication["directory"]) / "calibration-report.json").is_file()
            )
            self.assertFalse(
                (Path(publication["directory"]) / "calibration-benchmark.json").exists()
            )

            feed = workspace.publication_feed()
            self.assertEqual(1, len(feed))
            self.assertEqual("excavation-field-map.semantic-publication/v1", feed[0]["publication_schema"])
            self.assertEqual("hilyard-apartment-test", feed[0]["package_id"])
            self.assertNotIn("sealedChecks", feed[0]["manifest_json"])

            import_file.write_text("{}\n")
            with self.assertRaisesRegex(ValueError, "Immutable publication"):
                workspace.publish("hilyard", run["run_id"])
            self.assertEqual([], workspace.publication_feed())

    def test_publish_rejects_a_ready_run_after_authoritative_bundle_changes(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            shutil.copytree(REPOSITORY / "projects/hilyard", root / "projects/hilyard")
            workspace = StudioWorkspace(root, state_root=Path(state))
            run = workspace.run_project("hilyard")
            project_path = root / "projects/hilyard/project.json"
            project = json.loads(project_path.read_text())
            project["project"]["revision"] = "changed-after-run"
            project_path.write_text(json.dumps(project, indent=2, sort_keys=True) + "\n")

            with self.assertRaisesRegex(ValueError, "authoritative inputs changed"):
                workspace.publish("hilyard", run["run_id"])

    def test_incomplete_legacy_publication_is_not_advertised(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            publication_dir = Path(state) / "published/legacy-project/legacy-id"
            publication_dir.mkdir(parents=True)
            (publication_dir / "semantic-manifest.json").write_text("{}\n")
            (publication_dir / "handoff-manifest.json").write_text(json.dumps({
                "publication_id": "legacy-id",
                "published_at": "2026-08-21T10:00:00Z",
            }))

            publication = workspace._latest_publication("legacy-project")

            self.assertIsNone(publication)


if __name__ == "__main__":
    unittest.main()
