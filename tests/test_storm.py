import copy
import json
import math
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


class StormModelTests(unittest.TestCase):
    def setUp(self):
        self.model = load_project_bundle(PROJECT)
        self.points = {row["id"]: row for row in self.model["features"]["points"]}
        self.lines = {row["id"]: row for row in self.model["features"]["lines"]}
        self.polygons = {row["id"]: row for row in self.model["features"]["polygons"]}
        self.surfaces = {row["id"]: row for row in self.model["features"]["surfaces"]}
        self.storm = next(row for row in self.model["networks"] if row["system"] == "storm")
        self.roof = next(row for row in self.model["networks"] if row["system"] == "roof_drainage")
        self.storm_nodes = {row["id"]: row for row in self.storm["nodes"]}
        self.storm_edges = {row["id"]: row for row in self.storm["edges"]}

    def error_codes(self, model):
        return {issue.code for issue in validate_model(model) if issue.severity == "error"}

    def test_source_ledger_freezes_current_manual_and_city_storm_context(self):
        sources = {row["id"]: row for row in self.model["sources"]}
        manual = sources["src-eugene-stormwater-manual-2025"]
        self.assertEqual("City of Eugene", manual["authority"])
        self.assertEqual("69aa0e9a98c649dd4b5d88522d5027a024091dae969cb9f38f59ceda8abf3c7b", manual["lock"]["sha256"])
        self.assertIn("1.4-inch 24-hour water quality design storm", manual["supports"])
        gis = sources["src-eugene-storm-gis"]
        self.assertEqual("checksum_locked", gis["lock"]["status"])
        self.assertIn("reference-derived", gis["authority_note"])

    def test_declared_hydrologic_basis_is_numeric_but_not_an_approval_claim(self):
        basis = self.model["stormwater_basis"]
        self.assertEqual(4050.0, basis["roof_area_sf"])
        self.assertEqual(1.0, basis["roof_runoff_coefficient"])
        self.assertEqual(1.4, basis["water_quality_storm_in"])
        self.assertAlmostEqual(472.5, basis["water_quality_capture_volume_cf"], places=3)
        self.assertEqual(4.46, basis["ten_year_flood_control_storm_in"])
        self.assertAlmostEqual(1505.25, basis["ten_year_roof_volume_screening_cf"], places=3)
        self.assertEqual("screening_only_not_routed", basis["hydrologic_method_status"])
        self.assertEqual("unknown", basis["infiltration_status"])
        self.assertEqual("unknown", basis["public_capacity_status"])
        self.assertEqual("unknown", basis["downstream_hgl_status"])
        self.assertFalse(basis["permit_compliance_claim"])

        surface = self.surfaces["surface-storm-reference"]
        self.assertEqual("generated", surface["provenance"]["status"])
        self.assertEqual("storm-envelope-only", surface["field_detail"]["fitness_for_use"])
        self.assertFalse(surface["field_detail"]["survey_authority"])

    def test_roof_leaders_resolve_to_permanent_terminal_then_storm_system(self):
        roof_nodes = {row["id"]: row for row in self.roof["nodes"]}
        roof_edges = {row["id"]: row for row in self.roof["edges"]}
        self.assertEqual("penetration-roof-drainage", roof_nodes["roof-node-terminal"]["geometry_feature_id"])
        self.assertEqual({"roof-edge-leader-north", "roof-edge-leader-south"}, set(roof_edges))
        for edge in roof_edges.values():
            self.assertEqual("roof-node-terminal", edge["to_node_id"])
            self.assertGreater(edge["field_detail"]["upstream_invert_ft"], edge["field_detail"]["downstream_invert_ft"])
        terminal = self.points["penetration-roof-drainage"]
        self.assertEqual("storm-edge-roof-lateral-01", terminal["field_detail"]["connected_edge_id"])
        self.assertEqual("storm-node-roof-terminal", self.storm_edges["storm-edge-roof-lateral-01"]["from_node_id"])

    def test_storm_topology_includes_lined_planter_flow_control_and_reference_tie(self):
        required_edges = {
            "storm-edge-roof-lateral-01", "storm-edge-planter-inlet-01",
            "storm-edge-planter-underdrain-01", "storm-edge-outlet-01",
            "storm-edge-public-connection-01", "storm-edge-public-main-4183",
        }
        self.assertEqual(required_edges, set(self.storm_edges))
        self.assertIn("storm-planter-01", self.polygons)
        planter = self.polygons["storm-planter-01"]
        self.assertEqual("reviewed_assumption", planter["provenance"]["status"])
        self.assertEqual("lined_extended_filtration", planter["field_detail"]["facility_type"])
        self.assertEqual(500.0, planter["field_detail"]["declared_surface_storage_cf"])
        self.assertFalse(planter["field_detail"]["infiltration_credit_claimed"])
        self.assertLess(planter["field_detail"]["declared_surface_storage_cf"], self.model["stormwater_basis"]["ten_year_roof_volume_screening_cf"])
        self.assertEqual("unknown", planter["field_detail"]["flood_control_bypass_status"])

        tie = self.points["storm-public-mh-51800"]
        self.assertEqual(444.87, tie["field_detail"]["rim_elevation_navd88_ft"])
        self.assertEqual(434.33, tie["field_detail"]["public_outgoing_invert_navd88_ft"])
        self.assertEqual("not_reported", tie["field_detail"]["gis_survey_status"])
        self.assertFalse(tie["field_detail"]["survey_authority"])
        self.assertEqual("unknown", self.storm_nodes["storm-node-public-tie"]["field_detail"]["capacity_status"])
        self.assertEqual("unknown", self.storm_nodes["storm-node-public-tie"]["field_detail"]["owner_approval_status"])

    def test_proposed_storm_edges_have_grade_cover_material_workflow_and_unknown_hydraulics(self):
        for edge_id in (
            "storm-edge-roof-lateral-01", "storm-edge-planter-inlet-01",
            "storm-edge-planter-underdrain-01", "storm-edge-outlet-01",
            "storm-edge-public-connection-01",
        ):
            detail = self.storm_edges[edge_id]["field_detail"]
            self.assertGreater(detail["upstream_invert_ft"], detail["downstream_invert_ft"])
            self.assertGreaterEqual(detail["slope_percent"], detail["minimum_slope_percent"])
            self.assertGreaterEqual(min(detail["cover_samples_ft"]), detail["minimum_cover_ft"])
            self.assertGreater(detail["diameter_in"], 0)
            self.assertTrue(detail["material"])
            self.assertIn("materials", detail)
            self.assertIn("warnings", detail)
            self.assertIn("checklist", detail)
            self.assertEqual("unknown", detail["capacity_status"])
            self.assertEqual("unknown", detail["hgl_status"])

    def test_storm_crossing_clears_existing_sanitary_with_declared_tolerance(self):
        crossing = self.model["relationships"]["storm-sanitary-crossing-01"]
        self.assertEqual("storm-edge-public-connection-01", crossing["storm_edge_id"])
        self.assertEqual("san-edge-public-downstream", crossing["sanitary_edge_id"])
        self.assertEqual("storm_below_sanitary", crossing["configuration"])
        self.assertGreaterEqual(crossing["clearance_ft"], crossing["minimum_clearance_ft"])
        self.assertAlmostEqual(1.252694, crossing["clearance_ft"], places=5)
        self.assertEqual("reviewed_assumption", crossing["provenance"]["status"])

    def test_profile_reconciles_storm_edges_and_structure_drops(self):
        profile = next(row for row in self.model["deliverables"]["profiles"] if row["id"] == "profile-storm-roof-to-public")
        for segment in profile["segments"]:
            detail = self.storm_edges[segment["edge_id"]]["field_detail"]
            for key in ("length_ft", "upstream_invert_ft", "downstream_invert_ft"):
                self.assertAlmostEqual(detail[key], segment[key], places=6)
        site_mh = self.storm_nodes["storm-node-site-drop-mh-01"]["field_detail"]
        self.assertEqual("external_drop_required", site_mh["drop_type"])
        self.assertGreater(site_mh["connection_drop_ft"], 2.0)

    def test_validator_rejects_storm_grade_cover_roof_disconnect_crossing_and_profile_drift(self):
        cases = []
        uphill = copy.deepcopy(self.model)
        next(row for row in uphill["networks"] if row["system"] == "storm")["edges"][0]["field_detail"]["downstream_invert_ft"] = 500.0
        cases.append((uphill, "storm.flow_not_downhill"))
        low_slope = copy.deepcopy(self.model)
        next(row for row in low_slope["networks"] if row["system"] == "storm")["edges"][0]["field_detail"]["slope_percent"] = 0.01
        cases.append((low_slope, "storm.slope_below_min"))
        low_cover = copy.deepcopy(self.model)
        next(row for row in low_cover["networks"] if row["system"] == "storm")["edges"][3]["field_detail"]["cover_samples_ft"] = [3.0]
        cases.append((low_cover, "storm.cover_below_min"))
        disconnected = copy.deepcopy(self.model)
        next(row for row in disconnected["networks"] if row["system"] == "roof_drainage")["edges"] = []
        cases.append((disconnected, "roof_drainage.terminal_disconnected"))
        conflict = copy.deepcopy(self.model)
        conflict["relationships"]["storm-sanitary-crossing-01"]["clearance_ft"] = 0.5
        cases.append((conflict, "utility.crossing_clearance_below_min"))
        drift = copy.deepcopy(self.model)
        next(row for row in drift["deliverables"]["profiles"] if row["id"] == "profile-storm-roof-to-public")["segments"][0]["length_ft"] += 1
        cases.append((drift, "profile.model_mismatch"))
        for model, code in cases:
            self.assertIn(code, self.error_codes(model), code)

    def test_semantic_package_exposes_storm_roof_and_surface_assets(self):
        semantic = build_semantic_manifest(self.model)
        utilities = {row["id"]: row for row in semantic["utilities"]}
        expected = set(self.storm_edges) | {row["id"] for row in self.roof["edges"]} | {
            row["id"] for row in next(n for n in self.model["networks"] if n["system"] == "sanitary")["edges"]
        }
        self.assertTrue(expected.issubset(utilities))
        self.assertIn("surface-storm-reference", {row["id"] for row in semantic["surfaces"]})
        for asset_id in set(self.storm_edges) | {row["id"] for row in self.roof["edges"]}:
            self.assertTrue(utilities[asset_id]["searchable"])
            self.assertTrue(utilities[asset_id]["clickable"])
            self.assertIn("fieldDetail", utilities[asset_id])

    def test_sanitary_values_remain_unchanged_by_coordinated_extension(self):
        sanitary = next(row for row in self.model["networks"] if row["system"] == "sanitary")
        edges = {row["id"]: row for row in sanitary["edges"]}
        self.assertEqual(439.70, edges["san-edge-service-01"]["field_detail"]["upstream_invert_ft"])
        self.assertEqual(439.049455, edges["san-edge-service-02"]["field_detail"]["downstream_invert_ft"])
        self.assertEqual(438.070855, edges["san-edge-public-downstream"]["field_detail"]["upstream_invert_ft"])


class StormBuildTests(unittest.TestCase):
    def test_build_preserves_storm_pages_in_coordinated_vector_set_and_actual_artifact_parity(self):
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
            self.assertEqual(8, len(reader.pages))
            page_text = [page.extract_text() or "" for page in reader.pages]
            self.assertIn("STORM / ROOF DRAINAGE PLAN", page_text[3])
            self.assertIn("STORM / ROOF DRAINAGE PROFILE", page_text[4])
            self.assertIn("STORM ASSET SCHEDULE / TEST DETAILS", page_text[5])
            for text in page_text:
                self.assertIn(DISCLAIMER, text)
            for page in reader.pages:
                self.assertEqual([], list(page.images))

            parity = json.loads((output / "parity-report.json").read_text())
            self.assertEqual("valid", parity["status"])
            self.assertEqual([], parity["mismatches"])
            self.assertEqual("pdf_content_stream_geometry_markers_vs_gpkg", parity["pdf_vs_geopackage"]["method"])
            self.assertLessEqual(parity["pdf_vs_geopackage"]["maximum_delta_ft"], 0.01)

            expected_counts = {"canonical_points": 33, "canonical_lines": 23, "canonical_polygons": 13, "canonical_surfaces": 2}
            for layer, expected in expected_counts.items():
                result = subprocess.run([str(QGIS_BIN / "ogrinfo"), "-json", "-features", str(output / "hilyard-site-layout.gpkg"), layer], text=True, capture_output=True)
                self.assertEqual(0, result.returncode, result.stderr)
                self.assertEqual(expected, len(json.loads(result.stdout)["layers"][0]["features"]), layer)


if __name__ == "__main__":
    unittest.main()
