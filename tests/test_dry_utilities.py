import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from civil_plan_factory.export import build_semantic_manifest
from civil_plan_factory.io import load_project_bundle
from civil_plan_factory.validation import validate_model


ROOT = Path(__file__).parents[1]
PROJECT = ROOT / "projects" / "hilyard" / "project.json"
QGIS_BIN = Path("/Applications/QGIS-final-4_2_1.app/Contents/MacOS")
DISCLAIMER = "FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION"


class DryUtilitiesModelTests(unittest.TestCase):
    def setUp(self):
        self.model = load_project_bundle(PROJECT)
        self.points = {row["id"]: row for row in self.model["features"]["points"]}
        self.lines = {row["id"]: row for row in self.model["features"]["lines"]}
        self.polygons = {row["id"]: row for row in self.model["features"]["polygons"]}
        self.networks = {row["system"]: row for row in self.model["networks"]}

    def error_codes(self, model):
        return {issue.code for issue in validate_model(model) if issue.severity == "error"}

    def test_source_ledger_separates_confirmed_owners_from_unknown_route_authority(self):
        sources = {row["id"]: row for row in self.model["sources"]}
        self.assertEqual("Eugene Water & Electric Board", sources["src-eweb-electric-trench-2014"]["authority"])
        self.assertEqual("checksum_locked", sources["src-eweb-electric-trench-2014"]["lock"]["status"])
        self.assertEqual("NW Natural", sources["src-nw-natural-builder-guidance-2026"]["authority"])
        self.assertEqual("City of Eugene", sources["src-eugene-telecom-providers-2023"]["authority"])
        self.assertIn("does not identify the provider serving this parcel", sources["src-eugene-telecom-providers-2023"]["authority_note"])

    def test_basis_preserves_shared_trench_and_owner_unknowns(self):
        basis = self.model["dry_utility_basis"]
        self.assertEqual(["power", "telecom_fiber"], basis["shared_trench_systems"])
        self.assertEqual("separate_owner_boxes_in_joint_use_zone", basis["vault_sharing_basis"])
        self.assertEqual("unknown", basis["telecom_provider_status"])
        self.assertEqual("unknown", basis["electric_load_transformer_capacity_status"])
        self.assertEqual("unknown", basis["gas_main_location_capacity_status"])
        self.assertFalse(basis["capacity_or_approval_claim"])

    def test_four_dry_networks_connect_to_permanent_terminals(self):
        expected = {
            "power": "penetration-electric",
            "telecom_fiber": "penetration-telecom-fiber",
            "gas": "penetration-gas",
            "site_lighting": "penetration-site-lighting",
        }
        for system, terminal in expected.items():
            network = self.networks[system]
            node = next(row for row in network["nodes"] if row["geometry_feature_id"] == terminal)
            self.assertTrue(any(node["id"] in {edge["from_node_id"], edge["to_node_id"]} for edge in network["edges"]))

    def test_power_and_telecom_share_corridor_but_not_owner_enclosures(self):
        corridor = self.polygons["dry-shared-trench-corridor-01"]
        self.assertEqual("shared_dry_utility_trench", corridor["feature_type"])
        self.assertEqual(["power", "telecom_fiber"], corridor["field_detail"]["systems"])
        self.assertNotEqual(self.points["electric-vault-01"]["coordinates"], self.points["telecom-handhole-01"]["coordinates"])
        for system in ("power", "telecom_fiber"):
            for edge in self.networks[system]["edges"][:2]:
                self.assertEqual("dry-shared-trench-corridor-01", edge["field_detail"]["shared_trench_id"])

    def test_gas_is_not_silently_put_in_joint_trench(self):
        for edge in self.networks["gas"]["edges"]:
            self.assertIsNone(edge["field_detail"]["shared_trench_id"])
            self.assertEqual("separate_route", edge["field_detail"]["trench_basis"])
            self.assertEqual("unknown", edge["field_detail"]["capacity_status"])

    def test_dry_edges_have_installation_and_unresolved_owner_fields(self):
        for system in ("power", "telecom_fiber", "gas", "site_lighting"):
            for edge in self.networks[system]["edges"]:
                detail = edge["field_detail"]
                self.assertGreater(detail["length_ft"], 0)
                self.assertGreater(detail["conduit_or_pipe_count"], 0)
                self.assertTrue(detail["material"])
                self.assertEqual("unknown", detail["capacity_status"])
                self.assertEqual("unknown", detail["owner_approval_status"])
                self.assertIn("warnings", detail)
                self.assertIn("checklist", detail)

    def test_assumed_routes_carry_unmistakable_display_safety_flags(self):
        for feature in self.lines.values():
            if feature.get("system") not in {"power", "telecom_fiber", "gas", "site_lighting"}:
                continue
            self.assertEqual("reviewed_assumption", feature["provenance"]["status"])
            self.assertIn("ASSUMED ROUTE", feature["label"])
            self.assertEqual("dashed", feature["field_detail"]["display_style"]["line_style"])
            self.assertEqual("ASSUMED", feature["field_detail"]["display_style"]["status_badge"])

    def test_validator_rejects_disconnected_terminal_missing_material_and_fake_capacity(self):
        disconnected = copy.deepcopy(self.model)
        next(row for row in disconnected["networks"] if row["system"] == "power")["edges"] = []
        self.assertIn("dry.terminal_disconnected", self.error_codes(disconnected))
        missing_material = copy.deepcopy(self.model)
        next(row for row in missing_material["networks"] if row["system"] == "gas")["edges"][0]["field_detail"]["material"] = ""
        self.assertIn("dry.installation_data_missing", self.error_codes(missing_material))
        fake_capacity = copy.deepcopy(self.model)
        next(row for row in fake_capacity["networks"] if row["system"] == "telecom_fiber")["edges"][0]["field_detail"]["capacity_status"] = "adequate"
        self.assertIn("dry.unsupported_capacity_claim", self.error_codes(fake_capacity))

    def test_semantic_package_exposes_each_dry_system(self):
        semantic = build_semantic_manifest(self.model)
        utilities = {row["id"]: row for row in semantic["utilities"]}
        for system in ("power", "telecom_fiber", "gas", "site_lighting"):
            for edge in self.networks[system]["edges"]:
                self.assertEqual(system, utilities[edge["id"]]["system"])
                self.assertTrue(utilities[edge["id"]]["searchable"])
                self.assertTrue(utilities[edge["id"]]["clickable"])

    def test_wet_utility_values_remain_regression_locked(self):
        sanitary = next(row for row in self.model["networks"] if row["system"] == "sanitary")
        storm = next(row for row in self.model["networks"] if row["system"] == "storm")
        domestic = next(row for row in self.model["networks"] if row["system"] == "domestic_water")
        self.assertEqual(439.70, sanitary["edges"][0]["field_detail"]["upstream_invert_ft"])
        self.assertEqual(442.4, storm["edges"][0]["field_detail"]["upstream_invert_ft"])
        self.assertEqual(2, domestic["edges"][0]["field_detail"]["diameter_in"])


class DryUtilitiesBuildTests(unittest.TestCase):
    def test_build_emits_dry_plan_schedule_and_real_geometry_parity(self):
        with tempfile.TemporaryDirectory() as directory:
            command = [sys.executable, "-m", "civil_plan_factory", "build", str(PROJECT), "--output-dir", directory, "--qgis-app", "/Applications/QGIS-final-4_2_1.app"]
            env = os.environ.copy()
            env["PYTHONPATH"] = str(ROOT / "src")
            for _ in range(2):
                result = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True)
                self.assertEqual(0, result.returncode, result.stderr)
            output = Path(directory)
            from pypdf import PdfReader
            reader = PdfReader(output / "hilyard-site-layout.pdf")
            self.assertEqual(9, len(reader.pages))
            page_text = [page.extract_text() or "" for page in reader.pages]
            self.assertIn("DOMESTIC WATER, FIRE SERVICE, AND COORDINATED DRY UTILITIES", page_text[6])
            self.assertIn("dry-shared-trench-corridor-01", page_text[6])
            self.assertIn("network-power", page_text[8])
            for text in page_text:
                self.assertIn(DISCLAIMER, text)
            for page in reader.pages:
                self.assertEqual([], list(page.images))
            parity = json.loads((output / "parity-report.json").read_text())
            self.assertEqual("valid", parity["status"])
            self.assertEqual([], parity["mismatches"])
            self.assertEqual(0.0, parity["pdf_vs_geopackage"]["maximum_delta_ft"])
            expected_counts = {"canonical_points": 50, "canonical_lines": 48, "canonical_polygons": 34, "canonical_surfaces": 5}
            for layer, expected in expected_counts.items():
                result = subprocess.run([str(QGIS_BIN / "ogrinfo"), "-json", "-features", str(output / "hilyard-site-layout.gpkg"), layer], text=True, capture_output=True)
                self.assertEqual(0, result.returncode, result.stderr)
                self.assertEqual(expected, len(json.loads(result.stdout)["layers"][0]["features"]), layer)


if __name__ == "__main__":
    unittest.main()
