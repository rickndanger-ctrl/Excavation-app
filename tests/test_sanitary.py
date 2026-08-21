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


class SanitaryModelTests(unittest.TestCase):
    def setUp(self):
        self.model = load_project_bundle(PROJECT)
        self.points = {row["id"]: row for row in self.model["features"]["points"]}
        self.lines = {row["id"]: row for row in self.model["features"]["lines"]}
        self.surfaces = {row["id"]: row for row in self.model["features"]["surfaces"]}
        self.network = next(row for row in self.model["networks"] if row["system"] == "sanitary")
        self.nodes = {row["id"]: row for row in self.network["nodes"]}
        self.edges = {row["id"]: row for row in self.network["edges"]}

    def error_codes(self, model):
        return {issue.code for issue in validate_model(model) if issue.severity == "error"}

    def test_vertical_basis_is_explicit_provisional_and_source_linked(self):
        surface = self.surfaces["surface-existing-sanitary-reference"]
        self.assertEqual("generated", surface["provenance"]["status"])
        self.assertIn("src-eugene-wastewater-gis", surface["provenance"]["source_ids"])
        self.assertEqual("NAVD88", surface["vertical_datum"])
        self.assertEqual("sanitary-envelope-only", surface["field_detail"]["fitness_for_use"])
        self.assertFalse(surface["field_detail"]["survey_authority"])

        building = next(row for row in self.model["features"]["polygons"] if row["id"] == "building-apartment-1")
        self.assertEqual(445.0, building["field_detail"]["finished_floor_elevation_ft"])
        self.assertEqual("reviewed_assumption", building["field_detail"]["finished_floor_elevation_status"])
        self.assertTrue(building["field_detail"]["finished_floor_elevation_provisional"])

        west = self.points["sanitary-public-mh-13262"]
        east = self.points["sanitary-public-mh-2039"]
        self.assertEqual(443.87, west["field_detail"]["rim_elevation_navd88_ft"])
        self.assertEqual("not_reported", west["field_detail"]["gis_survey_status"])
        self.assertEqual(444.27, east["field_detail"]["rim_elevation_navd88_ft"])
        self.assertEqual("Yes", east["field_detail"]["gis_survey_status"])
        self.assertEqual("reference-derived", east["provenance"]["status"])

    def test_gravity_topology_uses_permanent_wall_terminal_and_resolves(self):
        self.assertEqual("penetration-sanitary", self.nodes["san-node-building-terminal"]["geometry_feature_id"])
        terminal = self.points["penetration-sanitary"]
        self.assertFalse(terminal["field_detail"]["terminal_only"])
        self.assertEqual(439.70, terminal["field_detail"]["invert_ft"])
        self.assertEqual("san-edge-service-01", terminal["field_detail"]["connected_edge_id"])
        self.assertNotIn("invert_ft", terminal["field_detail"]["unavailable"])
        self.assertEqual("san-node-building-terminal", self.edges["san-edge-service-01"]["from_node_id"])
        self.assertEqual("san-node-cleanout-01", self.edges["san-edge-service-01"]["to_node_id"])
        self.assertEqual("san-node-cleanout-01", self.edges["san-edge-service-02"]["from_node_id"])
        self.assertEqual("san-node-tie-in-01", self.edges["san-edge-service-02"]["to_node_id"])
        self.assertEqual("san-node-public-downstream", self.edges["san-edge-public-downstream"]["to_node_id"])
        node_ids = set(self.nodes)
        for edge in self.edges.values():
            self.assertIn(edge["from_node_id"], node_ids)
            self.assertIn(edge["to_node_id"], node_ids)

        tie = self.points["sanitary-tie-in-01"]
        self.assertEqual("reviewed_assumption", tie["provenance"]["status"])
        self.assertEqual("unknown", tie["field_detail"]["owner_approval_status"])
        self.assertEqual("unknown", tie["field_detail"]["capacity_status"])

    def test_service_segments_have_computed_gravity_and_field_contract(self):
        expected = {
            "san-edge-service-01": (8.0, 439.70, 439.62),
            "san-edge-service-02": (57.054501, 439.62, 439.049455),
        }
        for edge_id, (length, upstream, downstream) in expected.items():
            detail = self.edges[edge_id]["field_detail"]
            self.assertAlmostEqual(length, detail["length_ft"], places=5)
            self.assertAlmostEqual(upstream, detail["upstream_invert_ft"], places=5)
            self.assertAlmostEqual(downstream, detail["downstream_invert_ft"], places=5)
            self.assertGreater(detail["upstream_invert_ft"], detail["downstream_invert_ft"])
            self.assertAlmostEqual(1.0, detail["slope_percent"], places=5)
            self.assertEqual(6, detail["diameter_in"])
            self.assertEqual("PVC", detail["material"])
            self.assertEqual(35, detail["sdr"])
            self.assertIsNone(detail["velocity_fps"])
            self.assertIsNone(detail["design_depth_ratio"])
            self.assertEqual("unknown_pending_design_flow", detail["hydraulic_status"])
            self.assertGreaterEqual(min(detail["cover_samples_ft"]), 4.0)
            self.assertIn("bedding", detail["materials"])
            self.assertIn("backfill", detail["materials"])
            self.assertIn("compaction", detail["materials"])
            self.assertIn("warnings", detail)
            self.assertIn("checklist", detail)

    def test_profile_matches_canonical_edges(self):
        profile = next(row for row in self.model["deliverables"]["profiles"] if row["id"] == "profile-sanitary-service")
        self.assertEqual(["san-edge-service-01", "san-edge-service-02"], profile["alignment_edge_ids"])
        for segment in profile["segments"]:
            detail = self.edges[segment["edge_id"]]["field_detail"]
            self.assertAlmostEqual(detail["length_ft"], segment["length_ft"], places=6)
            self.assertAlmostEqual(detail["upstream_invert_ft"], segment["upstream_invert_ft"], places=6)
            self.assertAlmostEqual(detail["downstream_invert_ft"], segment["downstream_invert_ft"], places=6)

    def test_validator_rejects_uphill_low_slope_low_cover_bad_drop_and_profile_drift(self):
        mutations = []
        uphill = copy.deepcopy(self.model)
        next(row for row in uphill["networks"] if row["system"] == "sanitary")["edges"][0]["field_detail"]["downstream_invert_ft"] = 440.0
        mutations.append((uphill, "sanitary.flow_not_downhill"))
        low_slope = copy.deepcopy(self.model)
        next(row for row in low_slope["networks"] if row["system"] == "sanitary")["edges"][0]["field_detail"]["slope_percent"] = 0.1
        mutations.append((low_slope, "sanitary.slope_below_min"))
        low_cover = copy.deepcopy(self.model)
        next(row for row in low_cover["networks"] if row["system"] == "sanitary")["edges"][0]["field_detail"]["cover_samples_ft"] = [3.9]
        mutations.append((low_cover, "sanitary.cover_below_min"))
        bad_drop = copy.deepcopy(self.model)
        next(row for row in bad_drop["networks"] if row["system"] == "sanitary")["nodes"][2]["field_detail"]["connection_drop_ft"] = 0.05
        mutations.append((bad_drop, "sanitary.structure_drop_invalid"))
        profile_drift = copy.deepcopy(self.model)
        next(row for row in profile_drift["deliverables"]["profiles"] if row["id"] == "profile-sanitary-service")["segments"][0]["length_ft"] += 1
        mutations.append((profile_drift, "profile.model_mismatch"))
        for model, expected_code in mutations:
            self.assertIn(expected_code, self.error_codes(model), expected_code)

    def test_semantic_package_exposes_clickable_sanitary_assets_and_workflow(self):
        semantic = build_semantic_manifest(self.model)
        utilities = {row["id"]: row for row in semantic["utilities"]}
        self.assertTrue(set(self.edges).issubset(utilities))
        for utility in (utilities[edge_id] for edge_id in self.edges):
            self.assertTrue(utility["searchable"])
            self.assertTrue(utility["clickable"])
            self.assertEqual(utility["id"], utility["mapTarget"])
            self.assertIn("fieldDetail", utility)
        self.assertEqual("penetration-sanitary", utilities["san-edge-service-01"]["terminalFeatureId"])


class SanitaryBuildTests(unittest.TestCase):
    def test_repeated_build_replaces_geopackage_layers_without_duplicate_features(self):
        with tempfile.TemporaryDirectory() as directory:
            command = [
                sys.executable, "-m", "civil_plan_factory", "build", str(PROJECT),
                "--output-dir", directory,
                "--qgis-app", "/Applications/QGIS-final-4_2_1.app",
            ]
            env = os.environ.copy()
            env["PYTHONPATH"] = str(ROOT / "src")
            for _ in range(2):
                result = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True)
                self.assertEqual(0, result.returncode, result.stderr)
            gpkg_path = Path(directory) / "hilyard-site-layout.gpkg"
            expected_counts = {"canonical_points": 50, "canonical_lines": 47, "canonical_polygons": 21, "canonical_surfaces": 5}
            for layer, expected in expected_counts.items():
                result = subprocess.run(
                    [str(QGIS_BIN / "ogrinfo"), "-json", "-features", str(gpkg_path), layer],
                    text=True, capture_output=True,
                )
                self.assertEqual(0, result.returncode, result.stderr)
                actual = len(json.loads(result.stdout)["layers"][0]["features"])
                self.assertEqual(expected, actual, layer)

    def test_build_preserves_sanitary_pages_in_coordinated_vector_set_and_actual_geometry_parity(self):
        with tempfile.TemporaryDirectory() as directory:
            command = [
                sys.executable, "-m", "civil_plan_factory", "build", str(PROJECT),
                "--output-dir", directory,
                "--qgis-app", "/Applications/QGIS-final-4_2_1.app",
            ]
            env = os.environ.copy()
            env["PYTHONPATH"] = str(ROOT / "src")
            result = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True)
            self.assertEqual(0, result.returncode, result.stderr)
            output = Path(directory)
            from pypdf import PdfReader
            pdf_path = output / "hilyard-site-layout.pdf"
            reader = PdfReader(pdf_path)
            self.assertEqual(12, len(reader.pages))
            page_text = [page.extract_text() or "" for page in reader.pages]
            self.assertIn("SANITARY SEWER PLAN", page_text[1])
            self.assertIn("SANITARY SEWER PROFILE", page_text[2])
            for text in page_text:
                self.assertIn(DISCLAIMER, text)
            self.assertIn("UNIQUE_ID 4589", "\n".join(page_text))
            self.assertIn("FFE 445.00 PROVISIONAL", "\n".join(page_text))
            for page in reader.pages:
                resources = page.get("/Resources", {})
                images = [obj for obj in resources.get("/XObject", {}).values() if obj.get_object().get("/Subtype") == "/Image"]
                self.assertEqual([], images)

            parity = json.loads((output / "parity-report.json").read_text())
            self.assertEqual("valid", parity["status"])
            self.assertEqual("pdf_content_stream_geometry_markers_vs_gpkg", parity["pdf_vs_geopackage"]["method"])
            self.assertEqual([], parity["mismatches"])
            self.assertLessEqual(parity["pdf_vs_geopackage"]["maximum_delta_ft"], 0.01)

            semantic = json.loads((output / "semantic-manifest.json").read_text())
            gpkg = subprocess.run(
                [str(QGIS_BIN / "ogrinfo"), "-json", "-features", str(output / "hilyard-site-layout.gpkg"), "canonical_lines"],
                text=True, capture_output=True,
            )
            self.assertEqual(0, gpkg.returncode, gpkg.stderr)
            gpkg_ids = {row["properties"]["id"] for row in json.loads(gpkg.stdout)["layers"][0]["features"]}
            semantic_ids = {row["geometryFeatureId"] for row in semantic["utilities"]}
            self.assertTrue({"sanitary-service-seg-01", "sanitary-service-seg-02"}.issubset(gpkg_ids & semantic_ids))


if __name__ == "__main__":
    unittest.main()
