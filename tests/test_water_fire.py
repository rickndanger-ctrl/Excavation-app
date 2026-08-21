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


class WaterFireModelTests(unittest.TestCase):
    def setUp(self):
        self.model = load_project_bundle(PROJECT)
        self.points = {row["id"]: row for row in self.model["features"]["points"]}
        self.lines = {row["id"]: row for row in self.model["features"]["lines"]}
        self.domestic = next(row for row in self.model["networks"] if row["system"] == "domestic_water")
        self.fire = next(row for row in self.model["networks"] if row["system"] == "fire_water")

    def error_codes(self, model):
        return {issue.code for issue in validate_model(model) if issue.severity == "error"}

    def test_source_ledger_locks_eweb_standard_and_reference_gis_context(self):
        sources = {row["id"]: row for row in self.model["sources"]}
        standard = sources["src-eweb-water-standards-2017"]
        self.assertEqual("Eugene Water & Electric Board", standard["authority"])
        self.assertEqual("1bf602447f69bacd4b3c6b9bb66be4547008dc6d03824b9ec9442e22d1950541", standard["lock"]["sha256"])
        self.assertIn("36-inch minimum service cover", standard["supports"])
        gis = sources["src-eweb-water-gis"]
        self.assertEqual("checksum_locked", gis["lock"]["status"])
        self.assertEqual("reference-derived", gis["provenance_status"])
        self.assertIn("not pressure, flow, capacity, or tie authority", gis["authority_note"])

    def test_declared_demand_and_fire_basis_preserves_unresolved_hydraulics(self):
        basis = self.model["water_fire_basis"]
        self.assertEqual(2, basis["domestic_service_diameter_in"])
        self.assertEqual("master_meter", basis["domestic_meter_basis"])
        self.assertEqual("RPBA", basis["domestic_backflow_basis"])
        self.assertEqual(6, basis["fire_service_diameter_in"])
        self.assertEqual("detector_double_check", basis["fire_backflow_basis"])
        self.assertEqual("unknown", basis["building_demand_status"])
        self.assertEqual("unknown", basis["available_pressure_status"])
        self.assertEqual("unknown", basis["fire_flow_test_status"])
        self.assertEqual("unknown", basis["hydraulic_model_status"])
        self.assertEqual("unknown", basis["fire_marshal_approval_status"])
        self.assertFalse(basis["capacity_or_approval_claim"])

    def test_reference_main_is_eight_inch_cast_iron_but_not_a_service_commitment(self):
        main = self.lines["water-public-main-34th-reference"]
        self.assertEqual("reference-derived", main["provenance"]["status"])
        self.assertEqual(8, main["field_detail"]["diameter_in"])
        self.assertEqual("CI", main["field_detail"]["material"])
        self.assertEqual(["DMN008152", "DMN019519"], main["field_detail"]["eweb_wam_ids"])
        self.assertEqual("unknown", main["field_detail"]["capacity_status"])
        self.assertFalse(main["field_detail"]["tie_authority"])
        hydrant = self.points["water-public-hydrant-92016"]
        self.assertEqual("unknown", hydrant["field_detail"]["flow_test_status"])

    def test_domestic_network_connects_reference_tie_meter_backflow_and_permanent_terminal(self):
        nodes = {row["id"]: row for row in self.domestic["nodes"]}
        edges = {row["id"]: row for row in self.domestic["edges"]}
        self.assertEqual({"dom-edge-tie-meter", "dom-edge-meter-backflow", "dom-edge-backflow-terminal"}, set(edges))
        self.assertEqual("penetration-domestic-water", nodes["dom-node-terminal"]["geometry_feature_id"])
        self.assertEqual("dom-node-terminal", edges["dom-edge-backflow-terminal"]["to_node_id"])
        self.assertEqual("domestic-water-meter-01", nodes["dom-node-meter"]["geometry_feature_id"])
        self.assertEqual("domestic-water-rpba-01", nodes["dom-node-backflow"]["geometry_feature_id"])

    def test_fire_network_connects_tie_valve_backflow_fdc_and_sprinkler_terminal(self):
        nodes = {row["id"]: row for row in self.fire["nodes"]}
        edges = {row["id"]: row for row in self.fire["edges"]}
        self.assertEqual(5, len(edges))
        self.assertEqual("penetration-fire-water", nodes["fire-node-terminal"]["geometry_feature_id"])
        self.assertEqual("fire-node-terminal", edges["fire-edge-junction-terminal"]["to_node_id"])
        self.assertEqual("fire-service-fdc-01", nodes["fire-node-fdc"]["geometry_feature_id"])
        self.assertEqual("fire-node-junction", edges["fire-edge-fdc-branch"]["to_node_id"])
        self.assertEqual("unknown", nodes["fire-node-fdc"]["field_detail"]["fire_marshal_approval_status"])

    def test_pressure_edges_carry_size_material_cover_workflow_and_unknown_hydraulics(self):
        for network in (self.domestic, self.fire):
            for edge in network["edges"]:
                detail = edge["field_detail"]
                self.assertGreater(detail["length_ft"], 0)
                self.assertGreater(detail["diameter_in"], 0)
                self.assertTrue(detail["material"])
                self.assertGreaterEqual(min(detail["cover_samples_ft"]), detail["minimum_cover_ft"])
                self.assertEqual("unknown", detail["available_pressure_status"])
                self.assertEqual("unknown", detail["capacity_status"])
                self.assertIn("warnings", detail)
                self.assertIn("checklist", detail)
                self.assertIn("restraint", detail)

    def test_declared_separations_clear_sanitary_and_storm_without_invented_vertical_data(self):
        relationships = self.model["relationships"]
        for relationship_id in (
            "domestic-sanitary-separation-01", "domestic-storm-separation-01",
            "fire-sanitary-separation-01", "fire-storm-separation-01",
        ):
            relationship = relationships[relationship_id]
            self.assertEqual("horizontal_clearance", relationship["relationship_type"])
            self.assertGreaterEqual(relationship["clearance_ft"], relationship["minimum_clearance_ft"])
            self.assertEqual("unknown", relationship["vertical_separation_status"])
            self.assertEqual("reviewed_assumption", relationship["provenance"]["status"])

    def test_validator_rejects_bad_cover_disconnected_terminals_missing_material_and_silent_hydraulics(self):
        cases = []
        low_cover = copy.deepcopy(self.model)
        next(row for row in low_cover["networks"] if row["system"] == "domestic_water")["edges"][0]["field_detail"]["cover_samples_ft"] = [2.0]
        cases.append((low_cover, "pressure.cover_below_min"))
        disconnected = copy.deepcopy(self.model)
        next(row for row in disconnected["networks"] if row["system"] == "fire_water")["edges"] = []
        cases.append((disconnected, "pressure.terminal_disconnected"))
        missing_material = copy.deepcopy(self.model)
        next(row for row in missing_material["networks"] if row["system"] == "fire_water")["edges"][0]["field_detail"]["material"] = ""
        cases.append((missing_material, "pressure.material_or_diameter_missing"))
        silent_claim = copy.deepcopy(self.model)
        next(row for row in silent_claim["networks"] if row["system"] == "domestic_water")["edges"][0]["field_detail"]["capacity_status"] = "adequate"
        cases.append((silent_claim, "pressure.unsupported_hydraulic_claim"))
        separation = copy.deepcopy(self.model)
        separation["relationships"]["fire-storm-separation-01"]["clearance_ft"] = 0.5
        cases.append((separation, "utility.crossing_clearance_below_min"))
        for model, code in cases:
            self.assertIn(code, self.error_codes(model), code)

    def test_semantic_package_exposes_both_pressure_networks_and_field_details(self):
        semantic = build_semantic_manifest(self.model)
        utilities = {row["id"]: row for row in semantic["utilities"]}
        expected = {row["id"] for row in self.domestic["edges"] + self.fire["edges"]}
        self.assertTrue(expected.issubset(utilities))
        for edge_id in expected:
            self.assertTrue(utilities[edge_id]["searchable"])
            self.assertTrue(utilities[edge_id]["clickable"])
            self.assertIn("fieldDetail", utilities[edge_id])

    def test_sanitary_and_storm_canonical_values_remain_unchanged(self):
        sanitary = {row["id"]: row for row in next(n for n in self.model["networks"] if n["system"] == "sanitary")["edges"]}
        storm = {row["id"]: row for row in next(n for n in self.model["networks"] if n["system"] == "storm")["edges"]}
        self.assertEqual(439.70, sanitary["san-edge-service-01"]["field_detail"]["upstream_invert_ft"])
        self.assertEqual(438.070855, sanitary["san-edge-public-downstream"]["field_detail"]["upstream_invert_ft"])
        self.assertEqual(442.4, storm["storm-edge-roof-lateral-01"]["field_detail"]["upstream_invert_ft"])
        self.assertEqual(434.8, storm["storm-edge-public-connection-01"]["field_detail"]["downstream_invert_ft"])
        self.assertEqual(1.252694, self.model["relationships"]["storm-sanitary-crossing-01"]["clearance_ft"])


class WaterFireBuildTests(unittest.TestCase):
    def test_build_emits_coordinated_water_fire_sheets_and_real_geometry_parity(self):
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
            self.assertEqual(12, len(reader.pages))
            page_text = [page.extract_text() or "" for page in reader.pages]
            self.assertIn("DOMESTIC WATER / FIRE SERVICE PLAN", page_text[6])
            self.assertIn("WATER / FIRE SEPARATION SCHEDULE / TEST DETAILS", page_text[7])
            context_stream = reader.pages[0].get_contents().get_data().decode("latin-1")
            self.assertIn("%MS_DISCIPLINE_SHEET_ONLY domestic_water", context_stream)
            self.assertIn("%MS_DISCIPLINE_SHEET_ONLY fire_water", context_stream)
            for text in page_text:
                self.assertIn(DISCLAIMER, text)
            for page in reader.pages:
                self.assertEqual([], list(page.images))

            parity = json.loads((output / "parity-report.json").read_text())
            self.assertEqual("valid", parity["status"])
            self.assertEqual([], parity["mismatches"])
            self.assertEqual(0.0, parity["pdf_vs_geopackage"]["maximum_delta_ft"])

            expected_counts = {"canonical_points": 50, "canonical_lines": 47, "canonical_polygons": 21, "canonical_surfaces": 5}
            for layer, expected in expected_counts.items():
                result = subprocess.run([str(QGIS_BIN / "ogrinfo"), "-json", "-features", str(output / "hilyard-site-layout.gpkg"), layer], text=True, capture_output=True)
                self.assertEqual(0, result.returncode, result.stderr)
                self.assertEqual(expected, len(json.loads(result.stdout)["layers"][0]["features"]), layer)


if __name__ == "__main__":
    unittest.main()
