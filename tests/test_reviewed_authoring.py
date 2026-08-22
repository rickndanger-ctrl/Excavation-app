import json
import hashlib
from pathlib import Path
import shutil
import tempfile
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from civil_plan_factory.build import verify_semantic_only_parity
from civil_plan_factory.export import build_semantic_manifest
from civil_plan_factory.io import load_project_bundle
from civil_plan_factory.reviewed_sources import adapter_for_checksum
from civil_plan_factory.studio import StudioWorkspace
from civil_plan_factory.validation import DISCLAIMER, validate_model


READING_SHA256 = "835e28d8d981b4c0a0c5840e006c4cc19f259fc7fcb218ddc744bfec97da97d1"
REPOSITORY = Path(__file__).resolve().parents[1]
TEST_PLAN_BYTES = b"%PDF-1.7\nself-contained reviewed-source adapter fixture\n%%EOF\n"
TEST_PLAN_SHA256 = hashlib.sha256(TEST_PLAN_BYTES).hexdigest()


def test_reading_adapter():
    production = adapter_for_checksum(READING_SHA256)
    if production is None:  # pragma: no cover - a direct production invariant
        raise AssertionError("Production Reading adapter is not registered")

    def build(intake_project, source):
        project, sources, decisions = production.build(intake_project, source)
        project["reviewed_source_adapter"]["source_sha256"] = TEST_PLAN_SHA256
        return project, sources, decisions

    return SimpleNamespace(
        adapter_id=production.adapter_id,
        title=production.title,
        source_sha256=TEST_PLAN_SHA256,
        build=build,
    )


class ReviewedSourceAuthoringTests(unittest.TestCase):
    def _workspace_with_reading_intake(self):
        repository = tempfile.TemporaryDirectory()
        state = tempfile.TemporaryDirectory()
        root = Path(repository.name).resolve()
        projects = root / "projects"
        projects.mkdir()
        workspace = StudioWorkspace(root, state_root=Path(state.name))
        workspace.create_project(
            "Reading Public Library Demo", "reading-public-library-demo"
        )
        workspace.add_input(
            "reading-public-library-demo",
            "25020-RPL_Bid_Drawings_2025_07_11.pdf",
            TEST_PLAN_BYTES,
        )
        self._test_adapter = test_reading_adapter()

        def lookup(checksum):
            if checksum == TEST_PLAN_SHA256:
                return self._test_adapter
            return adapter_for_checksum(checksum)

        adapter_patch = patch(
            "civil_plan_factory.studio.adapter_for_checksum", side_effect=lookup
        )
        adapter_patch.start()
        self.addCleanup(repository.cleanup)
        self.addCleanup(state.cleanup)
        self.addCleanup(adapter_patch.stop)
        return root, workspace

    def test_checksum_keyed_adapter_authors_only_reviewed_reading_features(self):
        root, workspace = self._workspace_with_reading_intake()

        availability = workspace.reviewed_authoring("reading-public-library-demo")
        result = workspace.author_reviewed_model("reading-public-library-demo")
        model = load_project_bundle(
            root / "projects" / "reading-public-library-demo" / "project.json"
        )

        self.assertEqual("available", availability["status"])
        self.assertEqual("reading-public-library-reviewed-v4", availability["adapter_id"])
        self.assertEqual(
            READING_SHA256,
            adapter_for_checksum(READING_SHA256).source_sha256,
        )
        self.assertEqual("complete", result["status"])
        self.assertEqual(58, result["authored_feature_count"])
        self.assertEqual(
            {
                "dry-utilities": 2,
                "finished-site": 17,
                "grading": 24,
                "sanitary": 4,
                "storm": 9,
                "water": 2,
            },
            result["layer_feature_counts"],
        )
        self.assertEqual([], [issue.to_dict() for issue in validate_model(model)])
        self.assertEqual(DISCLAIMER, model["project"]["disclaimer"])
        self.assertEqual("reading-reviewed-v4", model["project"]["revision"])
        self.assertEqual([], model["networks"], "unknown connectivity must not become a network")
        self.assertEqual("display_unit", model["spatial_reference"]["horizontal_units"])
        self.assertNotIn(
            "output_parity_horizontal_ft",
            model["spatial_reference"]["tolerances"],
        )
        self.assertEqual(
            0.001,
            model["spatial_reference"]["tolerances"]["output_parity_display_units"],
        )

        lines = model["features"]["lines"]
        sewer_line = next(line for line in lines if line["id"] == "survey-sewer-run")
        self.assertEqual([[34, 52], [76, 45]], sewer_line["coordinates"])
        self.assertEqual([[34, 28], [76, 35]], sewer_line["field_detail"]["source_review_coordinates"])
        self.assertEqual("8-in", sewer_line["field_detail"]["pipe_size"])
        self.assertEqual("PVC", sewer_line["field_detail"]["material"])
        self.assertNotIn("slope", sewer_line["field_detail"])
        self.assertNotIn("connections", sewer_line["field_detail"])
        self.assertFalse(any(line.get("system") in {"storm", "domestic_water", "power"} for line in lines))

        points = {point["id"]: point for point in model["features"]["points"]}
        self.assertEqual(162.54, points["survey-smh-west"]["field_detail"]["rim_elevation_ft"])
        self.assertEqual(154.49, points["survey-smh-west"]["field_detail"]["invert_in_ft"])
        self.assertEqual(154.44, points["survey-smh-west"]["field_detail"]["invert_out_ft"])
        self.assertNotIn("rim_elevation_ft", points["survey-smh-east"]["field_detail"])
        expected_source_id = model["sources"][0]["id"]
        self.assertTrue(all(
            feature["provenance"]["source_ids"] == [expected_source_id]
            for feature in model["features"]["points"] + model["features"]["lines"]
        ))
        self.assertTrue(all(
            feature["provenance"]["status"] == "reference-derived"
            for feature in model["features"]["points"] + model["features"]["lines"]
        ))

        source = model["sources"][0]
        self.assertEqual(TEST_PLAN_SHA256, source["lock"]["sha256"])
        self.assertEqual("reference-derived", source["provenance_status"])
        self.assertIn("grading", source["supports"])
        self.assertIn("dry-utilities", source["supports"])
        decisions = {decision["id"]: decision for decision in model["decisions"]}
        self.assertEqual(
            ["l2.1-grading-note-68", "l2.1-grading-note-80"],
            decisions["review-reading-grading"]["value"]["rejected_candidate_ids"],
        )
        self.assertIn("12-inch RCP", decisions["review-reading-storm"]["value"]["withheld_geometry"])
        self.assertIn("water main geometry", decisions["review-reading-water"]["value"]["withheld_geometry"])
        self.assertIn("OHW", decisions["review-reading-dry-utilities"]["value"]["withheld_geometry"])
        self.assertTrue(any("not calibrated field coordinates" in value for value in model["limitations"]))
        project_dir = root / "projects" / "reading-public-library-demo"
        self.assertEqual(
            "civil-plan-factory.source-ledger/v0.1.0",
            json.loads((project_dir / "sources.lock.json").read_text())["schema_version"],
        )
        self.assertEqual(
            "civil-plan-factory.decision-ledger/v0.1.0",
            json.loads((project_dir / "decisions.json").read_text())["schema_version"],
        )

    def test_reading_authoring_preserves_the_finished_site_as_real_geometry(self):
        """Catch a regression back to isolated labels on a generic review grid."""

        root, workspace = self._workspace_with_reading_intake()
        workspace.author_reviewed_model("reading-public-library-demo")
        model = load_project_bundle(
            root / "projects/reading-public-library-demo/project.json"
        )

        self.assertEqual(
            "reviewed_finished_site_model",
            model["artifact_contract"]["plan_availability"],
        )
        self.assertEqual(
            "Show field employees the recognizable finished job before technical layers are enabled.",
            model["artifact_contract"]["experience_goal"],
        )
        self.assertEqual("visual_base", model["artifact_contract"]["base_layer_role"])
        self.assertEqual(
            "approximate_plan_measurement",
            model["artifact_contract"].get("measurement_contract", {}).get("mode"),
        )
        self.assertEqual(
            "Verify in field - not for construction staking.",
            model["artifact_contract"].get("measurement_contract", {}).get("warning"),
        )
        self.assertEqual(
            "unavailable_until_sheet_scale_calibration",
            model["artifact_contract"].get("measurement_contract", {}).get("status"),
        )
        self.assertNotIn(
            "semantic_review_grid",
            model["artifact_contract"]["plan_availability"],
        )
        polygons = {feature["id"]: feature for feature in model["features"]["polygons"]}
        lines = {feature["id"]: feature for feature in model["features"]["lines"]}
        surfaces = {feature["id"]: feature for feature in model["features"]["surfaces"]}

        self.assertEqual(
            {
                "reading-library-footprint",
                "reading-existing-west-concrete-walk",
                "reading-proposed-concrete-walk",
                "reading-proposed-unit-paver-terrace",
                "reading-proposed-planting-bed-north",
                "reading-proposed-planting-bed-south",
                "reading-existing-south-lawn",
                "reading-existing-south-sidewalk",
                "reading-existing-east-sidewalk",
            },
            set(polygons),
        )
        self.assertTrue({
            "reading-limit-of-work",
            "reading-seat-wall-upper",
            "reading-seat-wall-middle",
            "reading-seat-wall-lower",
            "reading-east-granite-curb",
            "reading-south-granite-curb",
            "reading-terrace-stair-upper",
            "reading-terrace-stair-lower",
            "reading-proposed-contour-155",
            "reading-proposed-contour-156",
            "reading-proposed-contour-157",
        }.issubset(lines))
        building = polygons["reading-library-footprint"]["field_detail"]["source_review_coordinates"]
        self.assertGreater(max(point[0] for point in building) - min(point[0] for point in building), 35)
        self.assertLess(max(point[1] for point in building) - min(point[1] for point in building), 25)
        self.assertLess(
            max(point[0] for point in building),
            min(point[0] for point in polygons["reading-proposed-unit-paver-terrace"]["field_detail"]["source_review_coordinates"]),
            "the terrace must sit east of the library like L1.1",
        )
        self.assertLess(
            max(point[1] for point in building),
            min(point[1] for point in polygons["reading-existing-south-sidewalk"]["field_detail"]["source_review_coordinates"]),
            "the School Street sidewalk must sit south of the library",
        )
        self.assertEqual(
            {"reading-proposed-terrace-finish-grade"},
            set(surfaces),
        )
        self.assertTrue(all(
            polygon["coordinates"][0] == polygon["coordinates"][-1]
            for polygon in polygons.values()
        ))
        self.assertEqual(
            "L1.1",
            polygons["reading-proposed-unit-paver-terrace"]["field_detail"]["sheet"],
        )
        self.assertEqual(
            "L2.1",
            surfaces["reading-proposed-terrace-finish-grade"]["field_detail"]["sheet"],
        )
        self.assertEqual(
            "reviewed_finish_grade_envelope",
            surfaces["reading-proposed-terrace-finish-grade"]["feature_type"],
        )
        self.assertEqual(
            "reviewed_proposed_contour_reference",
            lines["reading-proposed-contour-155"]["feature_type"],
        )
        self.assertEqual(
            "uncalibrated_sheet_space",
            surfaces["reading-proposed-terrace-finish-grade"]["field_detail"]["coordinate_status"],
        )

        semantic = build_semantic_manifest(model)
        self.assertEqual(9, len(semantic["areas"]))
        self.assertEqual(1, len(semantic["surfaces"]))
        self.assertGreaterEqual(len(semantic["linearFeatures"]), 8)
        self.assertEqual("", semantic["plan"]["imageUrl"])

    def test_adapter_selection_fails_closed_without_touching_unknown_source_bundle(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            workspace = StudioWorkspace(root, state_root=Path(state))
            workspace.create_project("Unknown Plans", "unknown-plans")
            workspace.add_input(
                "unknown-plans", "unknown.pdf", b"%PDF-1.7\nnot the reviewed source\n%%EOF\n"
            )
            project_dir = root / "projects" / "unknown-plans"
            before = {
                name: (project_dir / name).read_bytes()
                for name in ("project.json", "sources.lock.json", "decisions.json")
            }

            availability = workspace.reviewed_authoring("unknown-plans")
            with self.assertRaisesRegex(ValueError, "No reviewed-source adapter"):
                workspace.author_reviewed_model("unknown-plans")

            self.assertEqual("unavailable", availability["status"])
            self.assertEqual(
                before,
                {
                    name: (project_dir / name).read_bytes()
                    for name in ("project.json", "sources.lock.json", "decisions.json")
                },
            )

    def test_temp_intake_never_falls_back_to_a_live_source_citation(self):
        root, workspace = self._workspace_with_reading_intake()
        ledger_path = root / "projects/reading-public-library-demo/sources.lock.json"
        ledger = json.loads(ledger_path.read_text())
        citation = Path(ledger["sources"][0]["citation"])
        copied_input = ledger_path.parent / citation

        self.assertFalse(citation.is_absolute())
        self.assertTrue(copied_input.is_relative_to(root))
        copied_input.unlink()

        availability = workspace.reviewed_authoring(
            "reading-public-library-demo"
        )
        self.assertEqual("unavailable", availability["status"])

    def test_relocated_reading_bundle_uses_only_its_copied_input(self):
        source_root, _ = self._workspace_with_reading_intake()
        source_project = source_root / "projects/reading-public-library-demo"

        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            relocated_root = Path(repository)
            (relocated_root / "projects").mkdir()
            relocated_project = relocated_root / "projects/reading-public-library-demo"
            shutil.copytree(source_project, relocated_project)
            shutil.rmtree(source_project)

            ledger = json.loads((relocated_project / "sources.lock.json").read_text())
            citation = Path(ledger["sources"][0]["citation"])
            self.assertFalse(citation.is_absolute())
            self.assertTrue((relocated_project / citation).is_file())

            workspace = StudioWorkspace(relocated_root, state_root=Path(state))
            availability = workspace.reviewed_authoring("reading-public-library-demo")
            result = workspace.author_reviewed_model("reading-public-library-demo")

            self.assertEqual("available", availability["status"])
            self.assertEqual("complete", result["status"])
            self.assertEqual(58, result["authored_feature_count"])

    def test_reviewed_adapter_refuses_checksum_matching_path_outside_project_bundle(self):
        root, workspace = self._workspace_with_reading_intake()
        project_dir = root / "projects/reading-public-library-demo"
        ledger_path = project_dir / "sources.lock.json"
        ledger = json.loads(ledger_path.read_text())
        escaped = root / "projects/escaped-source.pdf"
        escaped.write_bytes(TEST_PLAN_BYTES)
        ledger["sources"][0]["citation"] = "../escaped-source.pdf"
        ledger["sources"][0].pop("citation_scope", None)
        ledger_path.write_text(json.dumps(ledger, indent=2, sort_keys=True) + "\n")

        availability = workspace.reviewed_authoring(
            "reading-public-library-demo"
        )

        self.assertEqual("unavailable", availability["status"])
        self.assertEqual("source_unavailable", availability["integrity_status"])

    def test_manual_multi_source_project_with_reviewed_input_is_not_hijacked(self):
        with tempfile.TemporaryDirectory() as repository, tempfile.TemporaryDirectory() as state:
            root = Path(repository)
            (root / "projects").mkdir()
            shutil.copytree(
                REPOSITORY / "projects/hilyard", root / "projects/hilyard"
            )
            workspace = StudioWorkspace(root, state_root=Path(state))
            adapter = test_reading_adapter()

            def lookup(checksum):
                if checksum == TEST_PLAN_SHA256:
                    return adapter
                return adapter_for_checksum(checksum)

            with patch(
                "civil_plan_factory.studio.adapter_for_checksum", side_effect=lookup
            ):
                workspace.add_input(
                    "hilyard", "reading-reference.pdf", TEST_PLAN_BYTES
                )
                authoring = workspace.reviewed_authoring("hilyard")
                run = workspace.run_project("hilyard")

            project = json.loads((root / "projects/hilyard/project.json").read_text())
            self.assertNotIn("reviewed_source_adapter", project)
            self.assertEqual("unavailable", authoring["status"])
            self.assertEqual(
                "adapter_not_selected", authoring["integrity_status"]
            )
            self.assertEqual("ready", run["publication_readiness"])

    def test_authored_bundle_drift_is_not_complete_and_reauthoring_restores_exact_output(self):
        root, workspace = self._workspace_with_reading_intake()
        project_dir = root / "projects" / "reading-public-library-demo"
        first = workspace.author_reviewed_model("reading-public-library-demo")
        approved_run = workspace.run_project("reading-public-library-demo")
        baseline = {
            name: (project_dir / name).read_bytes()
            for name in ("project.json", "sources.lock.json", "decisions.json")
        }
        project = json.loads((project_dir / "project.json").read_text())
        grading = [
            point for point in project["features"]["points"]
            if point["layer_id"] == "grading"
        ]
        self.assertEqual(20, len(grading))
        project["features"]["points"].remove(grading[-1])
        (project_dir / "project.json").write_text(
            json.dumps(project, indent=2, sort_keys=True) + "\n"
        )

        drifted = workspace.reviewed_authoring("reading-public-library-demo")

        self.assertRegex(first["authored_bundle_sha256"], r"^[0-9a-f]{64}$")
        self.assertEqual("available", drifted["status"])
        self.assertEqual("drifted", drifted["integrity_status"])
        with self.assertRaisesRegex(ValueError, "drifted"):
            workspace.run_project("reading-public-library-demo")
        with self.assertRaisesRegex(ValueError, "drifted"):
            workspace.publish("reading-public-library-demo", approved_run["run_id"])

        restored = workspace.author_reviewed_model("reading-public-library-demo")
        recovered_run = workspace.run_project("reading-public-library-demo")
        recovered_publication = workspace.publish(
            "reading-public-library-demo", recovered_run["run_id"]
        )

        self.assertEqual("complete", restored["status"])
        self.assertEqual("verified", restored["integrity_status"])
        self.assertTrue(restored["changed"])
        self.assertEqual("ready", recovered_run["publication_readiness"])
        self.assertTrue(Path(recovered_publication["offline_import_file"]).is_file())
        self.assertEqual(
            baseline,
            {
                name: (project_dir / name).read_bytes()
                for name in ("project.json", "sources.lock.json", "decisions.json")
            },
        )

    def test_checksum_adapter_refuses_supplemental_source_without_dropping_any_bytes(self):
        root, workspace = self._workspace_with_reading_intake()
        workspace.add_input(
            "reading-public-library-demo",
            "supplemental-plan.pdf",
            b"%PDF-1.7\nsupplemental source that has no reviewed adapter\n%%EOF\n",
        )
        project_dir = root / "projects" / "reading-public-library-demo"
        before = {
            path.relative_to(project_dir).as_posix(): path.read_bytes()
            for path in project_dir.rglob("*")
            if path.is_file()
        }

        availability = workspace.reviewed_authoring("reading-public-library-demo")
        with self.assertRaisesRegex(ValueError, "No reviewed-source adapter"):
            workspace.author_reviewed_model("reading-public-library-demo")

        self.assertEqual("unavailable", availability["status"])
        self.assertIn("exactly one", availability["reason"])
        self.assertEqual(
            before,
            {
                path.relative_to(project_dir).as_posix(): path.read_bytes()
                for path in project_dir.rglob("*")
                if path.is_file()
            },
        )

    def test_authoring_and_late_supplemental_intake_serialize_without_orphaning_source(self):
        root, workspace = self._workspace_with_reading_intake()
        real_adapter = self._test_adapter
        self.assertIsNotNone(real_adapter)
        build_entered = threading.Event()
        release_build = threading.Event()
        add_started = threading.Event()
        add_finished = threading.Event()
        errors = []

        def blocking_build(project, source):
            build_entered.set()
            if not release_build.wait(timeout=3):
                raise TimeoutError("test did not release reviewed adapter")
            return real_adapter.build(project, source)

        proxy = SimpleNamespace(
            adapter_id=real_adapter.adapter_id,
            title=real_adapter.title,
            source_sha256=real_adapter.source_sha256,
            build=blocking_build,
        )

        def author():
            try:
                workspace.author_reviewed_model("reading-public-library-demo")
            except Exception as error:  # pragma: no cover - asserted through errors
                errors.append(error)

        def add_supplement():
            add_started.set()
            try:
                workspace.add_input(
                    "reading-public-library-demo",
                    "late-supplement.pdf",
                    b"%PDF-1.7\nlate supplemental source\n%%EOF\n",
                )
            except Exception as error:  # pragma: no cover - asserted through errors
                errors.append(error)
            finally:
                add_finished.set()

        with patch("civil_plan_factory.studio.adapter_for_checksum", return_value=proxy):
            author_thread = threading.Thread(target=author)
            author_thread.start()
            self.assertTrue(build_entered.wait(timeout=2))
            add_thread = threading.Thread(target=add_supplement)
            add_thread.start()
            self.assertTrue(add_started.wait(timeout=1))
            self.assertFalse(
                add_finished.wait(timeout=0.2),
                "late intake must wait while canonical authoring owns the project mutation lock",
            )
            release_build.set()
            author_thread.join(timeout=3)
            add_thread.join(timeout=3)

        self.assertFalse(author_thread.is_alive())
        self.assertFalse(add_thread.is_alive())
        self.assertEqual([], errors)
        project_dir = root / "projects" / "reading-public-library-demo"
        ledger = json.loads((project_dir / "sources.lock.json").read_text())
        self.assertEqual(2, len(ledger["sources"]))
        supplemental = next(
            source for source in ledger["sources"]
            if source["title"] == "late-supplement.pdf"
        )
        self.assertEqual(
            hashlib.sha256(b"%PDF-1.7\nlate supplemental source\n%%EOF\n").hexdigest(),
            supplemental["lock"]["sha256"],
        )
        self.assertTrue((project_dir / supplemental["citation"]).is_file())

    def test_two_workspaces_serialize_authoring_and_late_intake_without_orphaning_source(self):
        root, authoring_workspace = self._workspace_with_reading_intake()
        intake_workspace = StudioWorkspace(
            root, state_root=authoring_workspace.state_root
        )
        real_adapter = self._test_adapter
        self.assertIsNotNone(real_adapter)
        build_entered = threading.Event()
        release_build = threading.Event()
        add_started = threading.Event()
        add_finished = threading.Event()
        errors = []

        def blocking_build(project, source):
            build_entered.set()
            if not release_build.wait(timeout=3):
                raise TimeoutError("test did not release reviewed adapter")
            return real_adapter.build(project, source)

        proxy = SimpleNamespace(
            adapter_id=real_adapter.adapter_id,
            title=real_adapter.title,
            source_sha256=real_adapter.source_sha256,
            build=blocking_build,
        )

        def author():
            try:
                authoring_workspace.author_reviewed_model(
                    "reading-public-library-demo"
                )
            except Exception as error:  # pragma: no cover - asserted through errors
                errors.append(error)

        def add_supplement():
            add_started.set()
            try:
                intake_workspace.add_input(
                    "reading-public-library-demo",
                    "second-workspace-supplement.pdf",
                    b"%PDF-1.7\nsecond workspace supplemental source\n%%EOF\n",
                )
            except Exception as error:  # pragma: no cover - asserted through errors
                errors.append(error)
            finally:
                add_finished.set()

        with patch("civil_plan_factory.studio.adapter_for_checksum", return_value=proxy):
            author_thread = threading.Thread(target=author)
            author_thread.start()
            self.assertTrue(build_entered.wait(timeout=2))
            add_thread = threading.Thread(target=add_supplement)
            add_thread.start()
            self.assertTrue(add_started.wait(timeout=1))
            blocked_while_authoring = not add_finished.wait(timeout=0.2)
            release_build.set()
            author_thread.join(timeout=3)
            add_thread.join(timeout=3)

        self.assertFalse(author_thread.is_alive())
        self.assertFalse(add_thread.is_alive())
        self.assertTrue(
            blocked_while_authoring,
            "a second workspace must wait on the repository-scoped project lock",
        )
        self.assertEqual([], errors)
        project_dir = root / "projects" / "reading-public-library-demo"
        ledger = json.loads((project_dir / "sources.lock.json").read_text())
        supplemental = [
            source
            for source in ledger["sources"]
            if source["title"] == "second-workspace-supplement.pdf"
        ]
        self.assertEqual(2, len(ledger["sources"]))
        self.assertEqual(1, len(supplemental))
        self.assertTrue((project_dir / supplemental[0]["citation"]).is_file())

    def test_project_detail_waits_through_atomic_authoring_promotion(self):
        root, authoring_workspace = self._workspace_with_reading_intake()
        detail_workspace = StudioWorkspace(
            root, state_root=authoring_workspace.state_root
        )
        project_dir = root / "projects/reading-public-library-demo"
        first_rename_complete = threading.Event()
        release_promotion = threading.Event()
        detail_started = threading.Event()
        detail_finished = threading.Event()
        errors = []
        details = []
        real_replace = Path.replace

        def controlled_replace(path, target):
            result = real_replace(path, target)
            if path == project_dir and Path(target).name == "previous":
                first_rename_complete.set()
                if not release_promotion.wait(timeout=3):
                    raise TimeoutError("test did not release project promotion")
            return result

        def author():
            try:
                authoring_workspace.author_reviewed_model(
                    "reading-public-library-demo"
                )
            except Exception as error:  # pragma: no cover - asserted through errors
                errors.append(error)

        def read_detail():
            detail_started.set()
            try:
                details.append(detail_workspace.project_detail(
                    "reading-public-library-demo"
                ))
            except Exception as error:  # pragma: no cover - asserted through errors
                errors.append(error)
            finally:
                detail_finished.set()

        with patch.object(Path, "replace", new=controlled_replace):
            author_thread = threading.Thread(target=author)
            author_thread.start()
            self.assertTrue(first_rename_complete.wait(timeout=2))
            detail_thread = threading.Thread(target=read_detail)
            detail_thread.start()
            self.assertTrue(detail_started.wait(timeout=1))
            blocked_during_promotion = not detail_finished.wait(timeout=0.2)
            release_promotion.set()
            author_thread.join(timeout=3)
            detail_thread.join(timeout=3)

        self.assertTrue(blocked_during_promotion)
        self.assertFalse(author_thread.is_alive())
        self.assertFalse(detail_thread.is_alive())
        self.assertEqual([], errors)
        self.assertEqual("complete", details[0]["reviewed_authoring"]["status"])

    def test_interrupted_promotion_restores_the_single_previous_authority(self):
        root, workspace = self._workspace_with_reading_intake()
        project_dir = root / "projects/reading-public-library-demo"
        baseline = {
            name: (project_dir / name).read_bytes()
            for name in ("project.json", "sources.lock.json", "decisions.json")
        }
        real_replace = Path.replace

        def crash_after_first_rename(path, target):
            if (
                path.name == "project"
                and ".authoring-" in path.parent.name
                and Path(target) == project_dir
            ):
                raise SystemExit("simulated process death before promotion")
            return real_replace(path, target)

        with patch.object(Path, "replace", new=crash_after_first_rename):
            with self.assertRaisesRegex(SystemExit, "simulated process death"):
                workspace.author_reviewed_model("reading-public-library-demo")

        self.assertFalse(project_dir.exists())
        backups = list(
            (root / "projects").glob(
                ".reading-public-library-demo.authoring-*/previous/project.json"
            )
        )
        self.assertEqual(1, len(backups))

        recovered_workspace = StudioWorkspace(
            root, state_root=workspace.state_root
        )
        detail = recovered_workspace.project_detail("reading-public-library-demo")

        self.assertEqual("available", detail["reviewed_authoring"]["status"])
        self.assertEqual(
            baseline,
            {
                name: (project_dir / name).read_bytes()
                for name in ("project.json", "sources.lock.json", "decisions.json")
            },
        )
        self.assertEqual([], list(
            (root / "projects").glob(
                ".reading-public-library-demo.authoring-*"
            )
        ))

    def test_stale_completed_transaction_is_cleaned_before_a_new_interruption(self):
        root, workspace = self._workspace_with_reading_intake()
        project_dir = root / "projects/reading-public-library-demo"
        real_rmtree = shutil.rmtree

        def crash_during_completed_cleanup(path, *args, **kwargs):
            if ".reading-public-library-demo.authoring-" in str(path):
                raise SystemExit("simulated death during completed cleanup")
            return real_rmtree(path, *args, **kwargs)

        with patch(
            "civil_plan_factory.studio.shutil.rmtree",
            side_effect=crash_during_completed_cleanup,
        ):
            with self.assertRaisesRegex(SystemExit, "completed cleanup"):
                workspace.author_reviewed_model("reading-public-library-demo")

        self.assertTrue(project_dir.is_dir())
        self.assertEqual(1, len(list(
            (root / "projects").glob(
                ".reading-public-library-demo.authoring-*"
            )
        )))
        project = json.loads((project_dir / "project.json").read_text())
        project["features"]["points"].pop()
        (project_dir / "project.json").write_text(
            json.dumps(project, indent=2, sort_keys=True) + "\n"
        )

        real_replace = Path.replace

        def crash_new_promotion(path, target):
            if (
                path.name == "project"
                and ".authoring-" in path.parent.name
                and Path(target) == project_dir
            ):
                raise SystemExit("simulated second interrupted promotion")
            return real_replace(path, target)

        with patch.object(Path, "replace", new=crash_new_promotion):
            with self.assertRaisesRegex(SystemExit, "second interrupted"):
                workspace.author_reviewed_model("reading-public-library-demo")

        backups = list(
            (root / "projects").glob(
                ".reading-public-library-demo.authoring-*/previous/project.json"
            )
        )
        self.assertEqual(1, len(backups), "obsolete transaction must not accumulate")

        recovered = StudioWorkspace(
            root, state_root=workspace.state_root
        ).project_detail("reading-public-library-demo")

        self.assertTrue(project_dir.is_dir())
        self.assertEqual("available", recovered["reviewed_authoring"]["status"])
        self.assertEqual("drifted", recovered["reviewed_authoring"]["integrity_status"])

    def test_authored_reading_bundle_builds_and_publishes_pdf_free_semantic_handoff(self):
        root, workspace = self._workspace_with_reading_intake()
        workspace.author_reviewed_model("reading-public-library-demo")

        run = workspace.run_project("reading-public-library-demo")
        publication = workspace.publish("reading-public-library-demo", run["run_id"])
        semantic = json.loads(Path(publication["import_file"]).read_text())
        envelope_path = Path(publication["offline_import_file"])
        envelope = json.loads(envelope_path.read_text())

        self.assertEqual("ready", run["publication_readiness"])
        self.assertFalse(any(name.endswith((".pdf", ".gpkg")) for name in run["artifacts"]))
        parity = json.loads(
            (Path(publication["directory"]) / "parity-report.json").read_text()
        )
        self.assertEqual("valid", parity["status"])
        self.assertEqual(
            "not_applicable_ungeoreferenced",
            parity["geospatial_artifacts"]["status"],
        )
        self.assertEqual("excavation-field-map.jobsite-package/v0.1.0", semantic["schema_version"])
        self.assertEqual(DISCLAIMER, semantic["disclaimer"])
        self.assertEqual(
            ["finished-site", "grading", "sanitary", "storm", "water", "dry-utilities"],
            [layer["id"] for layer in semantic["layers"]],
        )
        self.assertEqual(36, len(semantic["objects"]))
        self.assertEqual(12, len(semantic["linearFeatures"]))
        self.assertEqual(9, len(semantic["areas"]))
        self.assertEqual(1, len(semantic["surfaces"]))
        self.assertEqual([], semantic["utilities"])
        self.assertIn("uncalibrated", semantic["plan"]["coordinateBasis"].lower())
        self.assertGreater(len(semantic["unavailable"]), 0)
        self.assertEqual(
            {
                "publication_schema",
                "package_id",
                "package_version",
                "content_sha256",
                "created_at",
                "manifest_json",
            },
            set(envelope),
        )
        self.assertEqual(
            "excavation-field-map.semantic-publication/v1",
            envelope["publication_schema"],
        )
        self.assertEqual(semantic["id"], envelope["package_id"])
        self.assertEqual(run["run_id"], envelope["package_version"])
        self.assertTrue(envelope["created_at"].endswith("Z"))
        self.assertEqual(
            hashlib.sha256(envelope["manifest_json"].encode("utf-8")).hexdigest(),
            envelope["content_sha256"],
        )
        self.assertEqual(semantic, json.loads(envelope["manifest_json"]))
        self.assertEqual(
            envelope_path.name,
            "semantic-publication.json",
        )
        for json_path in Path(publication["directory"]).glob("*.json"):
            self.assertNotIn(
                str(root),
                json_path.read_text(),
                f"published artifact leaked an absolute producer path: {json_path.name}",
            )

        handoff_path = Path(publication["handoff_manifest"])
        original_handoff = handoff_path.read_bytes()
        handoff = json.loads(original_handoff)
        handoff["published_at"] = "2099-01-01T00:00:00Z"
        handoff["consumer"]["integration_seam"] = "tampered import instructions"
        handoff_path.write_text(json.dumps(handoff, indent=2, sort_keys=True) + "\n")
        with self.assertRaisesRegex(ValueError, "Immutable publication"):
            workspace.publish("reading-public-library-demo", run["run_id"])
        handoff_path.write_bytes(original_handoff)

        envelope_path.write_text("{}\n")
        handoff = json.loads(handoff_path.read_text())
        handoff["artifacts"][envelope_path.name] = hashlib.sha256(
            envelope_path.read_bytes()
        ).hexdigest()
        handoff_path.write_text(json.dumps(handoff, indent=2, sort_keys=True) + "\n")
        with self.assertRaisesRegex(ValueError, "Immutable publication"):
            workspace.publish("reading-public-library-demo", run["run_id"])

    def test_semantic_only_parity_rejects_a_corrupted_feature_label(self):
        root, workspace = self._workspace_with_reading_intake()
        workspace.author_reviewed_model("reading-public-library-demo")
        model = load_project_bundle(
            root / "projects/reading-public-library-demo/project.json"
        )
        semantic = build_semantic_manifest(model)
        semantic["objects"][0]["label"] = "CORRUPTED LABEL"

        parity = verify_semantic_only_parity(model, semantic)

        self.assertEqual("invalid", parity["status"])
        self.assertTrue(any(
            mismatch.get("field") == "label"
            for mismatch in parity["mismatches"]
        ))

    def test_semantic_only_parity_rejects_corrupted_feature_provenance(self):
        root, workspace = self._workspace_with_reading_intake()
        workspace.author_reviewed_model("reading-public-library-demo")
        model = load_project_bundle(
            root / "projects/reading-public-library-demo/project.json"
        )
        semantic = build_semantic_manifest(model)
        semantic["objects"][0]["provenance"]["status"] = "unknown"

        parity = verify_semantic_only_parity(model, semantic)

        self.assertEqual("invalid", parity["status"])
        self.assertTrue(any(
            mismatch.get("field") == "provenance"
            for mismatch in parity["mismatches"]
        ))

    def test_semantic_only_parity_rejects_a_missing_layer(self):
        root, workspace = self._workspace_with_reading_intake()
        workspace.author_reviewed_model("reading-public-library-demo")
        model = load_project_bundle(
            root / "projects/reading-public-library-demo/project.json"
        )
        semantic = build_semantic_manifest(model)
        semantic["layers"] = semantic["layers"][1:]

        parity = verify_semantic_only_parity(model, semantic)

        self.assertEqual("invalid", parity["status"])
        self.assertTrue(any(
            mismatch.get("field") == "layers"
            for mismatch in parity["mismatches"]
        ))


if __name__ == "__main__":
    unittest.main()
