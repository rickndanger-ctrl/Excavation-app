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


def polygon_area(ring):
    return abs(sum(
        a[0] * b[1] - b[0] * a[1]
        for a, b in zip(ring, ring[1:])
    )) / 2


def point_on_ring(point, ring, tolerance=1e-6):
    px, py = point[:2]
    for a, b in zip(ring, ring[1:]):
        ax, ay = a[:2]
        bx, by = b[:2]
        cross = (px - ax) * (by - ay) - (py - ay) * (bx - ax)
        if abs(cross) > tolerance:
            continue
        dot = (px - ax) * (px - bx) + (py - ay) * (py - by)
        if dot <= tolerance:
            return True
    return False


def point_segment_distance(point, start, end):
    px, py = point[:2]
    ax, ay = start[:2]
    bx, by = end[:2]
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    ratio = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + ratio * dx), py - (ay + ratio * dy))


def polygon_clearance(a, b):
    return min(
        [point_segment_distance(point, start, end) for point in a[:-1] for start, end in zip(b, b[1:])]
        + [point_segment_distance(point, start, end) for point in b[:-1] for start, end in zip(a, a[1:])]
    )


class SiteLayoutModelTests(unittest.TestCase):
    def setUp(self):
        self.model = load_project_bundle(PROJECT)
        self.points = {row["id"]: row for row in self.model["features"]["points"]}
        self.lines = {row["id"]: row for row in self.model["features"]["lines"]}
        self.polygons = {row["id"]: row for row in self.model["features"]["polygons"]}

    def test_freezes_four_official_taxlot_polygons_in_epsg_6823(self):
        expected = {"taxlot-10900", "taxlot-11000", "taxlot-11200", "taxlot-11400"}
        actual = {feature_id for feature_id in self.polygons if feature_id.startswith("taxlot-")}
        self.assertEqual(expected, actual)
        self.assertEqual([186302.989091, 98609.991274], self.polygons["taxlot-10900"]["coordinates"][0])
        for feature_id in expected:
            feature = self.polygons[feature_id]
            self.assertEqual("reference-derived", feature["provenance"]["status"])
            self.assertIn("src-eugene-taxlots-gis", feature["provenance"]["source_ids"])
            self.assertFalse(feature["field_detail"]["survey_authority"])
            self.assertEqual("supersede_first_when_boundary_survey_arrives", feature["field_detail"].get("replacement_priority"))
            self.assertNotEqual(
                feature["provenance"]["status"],
                self.polygons["building-apartment-1"]["provenance"]["status"],
            )

    def test_required_constraint_and_access_geometry_is_present_with_provenance(self):
        required_polygons = {
            "constraint-row-dedication",
            "constraint-eweb-west",
            "constraint-eweb-south",
            "constraint-sanitary-easement",
            "constraint-wetland",
        }
        self.assertTrue(required_polygons.issubset(self.polygons))
        self.assertIn("access-edge-east-34th", self.lines)
        self.assertIn("street-edge-hilyard", self.lines)
        wetland = self.polygons["constraint-wetland"]
        self.assertAlmostEqual(0.13, polygon_area(wetland["coordinates"]) / 43560, delta=0.01)
        for feature_id in required_polygons:
            feature = self.polygons[feature_id]
            self.assertEqual("reference-derived", feature["provenance"]["status"])
            self.assertGreater(len(feature["provenance"]["source_ids"]), 0)
            self.assertIn("reference-scale", feature["field_detail"]["accuracy_note"])

    def test_reviewed_building_and_pad_are_true_polygons_clear_of_constraints(self):
        self.assertIn("building-apartment-1", self.polygons)
        self.assertIn("pad-apartment-1", self.polygons)
        building = self.polygons["building-apartment-1"]
        pad = self.polygons["pad-apartment-1"]
        self.assertEqual(4050.0, polygon_area(building["coordinates"]))
        self.assertEqual(5500.0, polygon_area(pad["coordinates"]))
        self.assertEqual([45.0, 90.0], building["field_detail"]["dimensions_ft"])
        self.assertEqual("reviewed_assumption", building["provenance"]["status"])
        self.assertIn("decision-building-footprint", building["provenance"]["decision_ids"])
        for constraint_id in (
            "constraint-row-dedication", "constraint-eweb-west", "constraint-eweb-south",
            "constraint-sanitary-easement", "constraint-wetland",
        ):
            self.assertGreater(
                polygon_clearance(pad["coordinates"], self.polygons[constraint_id]["coordinates"]),
                0.0,
                constraint_id,
            )
        self.assertEqual(445.0, building["field_detail"]["finished_floor_elevation_ft"])
        self.assertEqual("reviewed_assumption", building["field_detail"]["finished_floor_elevation_status"])
        self.assertTrue(building["field_detail"]["finished_floor_elevation_provisional"])

    def test_finished_job_base_contains_flatwork_paving_landscape_and_location_tips(self):
        required = {
            "sidewalk-south-entry",
            "sidewalk-north-entry",
            "sidewalk-east-service",
            "sidewalk-arrival-link",
            "paving-arrival-court",
            "landscape-north-court",
        }
        self.assertTrue(required.issubset(self.polygons))
        for feature_id in required:
            feature = self.polygons[feature_id]
            self.assertEqual("site", feature["layer_id"])
            self.assertEqual("phase-07-finish-site", feature["phase_id"])
            self.assertEqual("reviewed_assumption", feature["provenance"]["status"])
            self.assertIn("decision-finished-site-layout", feature["provenance"]["decision_ids"])
            self.assertTrue(feature["field_detail"]["searchable"])
            self.assertEqual(feature_id, feature["field_detail"]["map_target"])

        south_walk = self.polygons["sidewalk-south-entry"]
        self.assertEqual([8.0, 10.5], south_walk["field_detail"]["dimensions_ft"])
        tips = south_walk["field_detail"]["measurement_tips"]
        self.assertEqual(1, len(tips))
        self.assertEqual("building-apartment-1", tips[0]["from"]["feature_id"])
        self.assertEqual("sidewalk-south-entry", tips[0]["to"]["feature_id"])
        self.assertEqual(18.5, tips[0]["distance_ft"])
        self.assertEqual("horizontal_plan_distance", tips[0]["method"])
        self.assertFalse(tips[0]["staking_authority"])

        coverage = {row["system"]: row for row in self.model["contract_coverage"]}
        self.assertEqual("modeled", coverage["sidewalks"]["availability"])
        self.assertEqual("modeled", coverage["paving"]["availability"])

    def test_entries_and_system_penetrations_are_stable_wall_bound_interfaces(self):
        self.assertIn("building-apartment-1", self.polygons)
        building_ring = self.polygons["building-apartment-1"]["coordinates"]
        entries = {feature_id for feature_id in self.points if feature_id.startswith("entry-")}
        self.assertEqual({"entry-south-primary", "entry-east-service", "entry-north-pedestrian"}, entries)
        penetrations = [row for row in self.points.values() if row["feature_type"] == "wall_penetration"]
        self.assertEqual(
            {"sanitary", "domestic_water", "fire_water", "roof_drainage", "electric", "telecom_fiber", "gas", "site_lighting"},
            {row["system"] for row in penetrations},
        )
        for point in [self.points[feature_id] for feature_id in entries] + penetrations:
            self.assertTrue(point_on_ring(point["coordinates"], building_ring), point["id"])
            self.assertEqual("building-apartment-1", point["wall_association_id"])
            self.assertEqual("reviewed_assumption", point["provenance"]["status"])
            self.assertTrue(point["field_detail"]["searchable"])
            self.assertIn("unavailable", point["field_detail"])
        for penetration in penetrations:
            self.assertEqual(penetration["id"], penetration.get("network_terminal_id"))
            self.assertTrue(penetration["field_detail"].get("permanent_terminal_reference", False))

    def test_validator_rejects_penetration_moved_off_its_wall(self):
        broken = copy.deepcopy(self.model)
        penetrations = [row for row in broken["features"]["points"] if row["feature_type"] == "wall_penetration"]
        self.assertGreater(len(penetrations), 0)
        penetration = penetrations[0]
        penetration["coordinates"] = [0, 0]
        errors = {issue.code for issue in validate_model(broken) if issue.severity == "error"}
        self.assertIn("interface.off_wall", errors)

    def test_validator_rejects_missing_scoped_system_terminal(self):
        broken = copy.deepcopy(self.model)
        broken["features"]["points"] = [
            row for row in broken["features"]["points"] if row["id"] != "penetration-gas"
        ]
        errors = {issue.code for issue in validate_model(broken) if issue.severity == "error"}
        self.assertIn("interface.missing_system", errors)

    def test_validator_rejects_pad_moved_into_a_constraint(self):
        broken = copy.deepcopy(self.model)
        pads = [row for row in broken["features"]["polygons"] if row["feature_type"] == "building_pad"]
        self.assertGreater(len(pads), 0)
        pads[0]["coordinates"] = [
            [186240, 98465], [186260, 98465], [186260, 98475], [186240, 98475], [186240, 98465]
        ]
        errors = {issue.code for issue in validate_model(broken) if issue.severity == "error"}
        self.assertIn("design.constraint_overlap", errors)

    def test_semantic_package_carries_searchable_areas_entries_and_penetrations(self):
        semantic = build_semantic_manifest(self.model)
        self.assertIn("areas", semantic)
        area_ids = {row["id"] for row in semantic["areas"]}
        object_ids = {row["id"] for row in semantic["objects"]}
        self.assertIn("building-apartment-1", area_ids)
        self.assertIn("constraint-wetland", area_ids)
        self.assertIn("entry-south-primary", object_ids)
        self.assertIn("penetration-sanitary", object_ids)
        for row in semantic["areas"] + semantic["objects"]:
            self.assertTrue(row["searchable"])
            self.assertTrue(row.get("clickable", False))
            self.assertEqual(row["id"], row.get("mapTarget"))
            self.assertTrue(row["label"])
            self.assertIn("fieldDetail", row)


class SiteLayoutBuildTests(unittest.TestCase):
    def test_model_studio_build_emits_vector_pdf_gpkg_semantic_and_valid_parity(self):
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
            expected = {
                "hilyard-site-layout.pdf", "hilyard-site-layout.gpkg",
                "semantic-manifest.json", "validation-report.json", "parity-report.json",
                "calibration-benchmark.json", "calibration-report.json",
            }
            self.assertEqual(expected, {path.name for path in output.iterdir()})

            benchmark = json.loads((output / "calibration-benchmark.json").read_text())
            self.assertEqual("civil-plan-factory.calibration-benchmark/v0.1.0", benchmark["schema_version"])
            self.assertEqual(DISCLAIMER, benchmark["disclaimer"])
            self.assertEqual("EPSG:6823", benchmark["coordinate_basis"]["horizontal_crs"])
            self.assertEqual("international_foot", benchmark["coordinate_basis"]["units"])
            self.assertEqual("reference-scale; not surveyed", benchmark["coordinate_basis"]["authority"])
            self.assertEqual(3, len(benchmark["visible_controls"]))
            self.assertEqual(15, len(benchmark["sealed_checks"]))
            checks = {row["id"]: row for row in benchmark["sealed_checks"]}
            self.assertTrue(
                {"building_width", "building_length", "building_diagonal"}.issubset(checks),
            )
            self.assertAlmostEqual(45.0, checks["building_width"]["expected_distance_ft"], places=6)
            self.assertAlmostEqual(90.0, checks["building_length"]["expected_distance_ft"], places=6)
            self.assertAlmostEqual(math.hypot(45.0, 90.0), checks["building_diagonal"]["expected_distance_ft"], places=6)
            self.assertEqual(18.5, checks["building_sw_to_south_walk"]["expected_distance_ft"])
            self.assertEqual(18.5, checks["building_nw_to_north_walk"]["expected_distance_ft"])
            self.assertEqual(12.5, checks["building_east_to_service_walk"]["expected_distance_ft"])
            self.assertTrue(all(row["withheld_from_app_import"] for row in benchmark["sealed_checks"]))

            calibration_report = json.loads((output / "calibration-report.json").read_text())
            self.assertEqual("valid", calibration_report["status"])
            self.assertEqual(3, calibration_report["control_count"])
            self.assertEqual(15, calibration_report["check_count"])
            self.assertEqual(15, calibration_report["passed_check_count"])
            self.assertLess(calibration_report["maximum_absolute_error_ft"], 0.000001)
            self.assertLess(calibration_report["control_rms_residual_ft"], 0.000001)

            semantic = json.loads((output / "semantic-manifest.json").read_text())
            self.assertEqual("passed_product_qa", semantic["planCalibration"]["status"])
            self.assertEqual(3, semantic["planCalibration"]["controlCount"])
            self.assertEqual(15, semantic["planCalibration"]["checkCount"])
            self.assertNotIn("sealedChecks", semantic["planCalibration"])

            from pypdf import PdfReader
            reader = PdfReader(output / "hilyard-site-layout.pdf")
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            self.assertIn(DISCLAIMER, text)
            self.assertIn("building-apartment-1", text)
            self.assertIn("penetration-sanitary", text)
            self.assertIn("E 34TH AVENUE - ACCESS BASIS", text)
            self.assertIn("HILYARD STREET - NO DRIVEWAY", text)
            self.assertIn("sidewalk-south-entry", text)
            self.assertIn("paving-arrival-court", text)
            self.assertIn("landscape-north-court", text)
            self.assertIn("DRAWING GRID ORIGIN: E ", text)
            content = b"\n".join(page.get_contents().get_data() for page in reader.pages)
            self.assertRegex(content, rb"\b(?:m|l|re)\b")
            image_xobjects = []
            for page in reader.pages:
                resources = page.get("/Resources", {})
                for obj in resources.get("/XObject", {}).values():
                    resolved = obj.get_object()
                    if resolved.get("/Subtype") == "/Image":
                        image_xobjects.append(resolved)
            self.assertEqual([], image_xobjects)

            parity = json.loads((output / "parity-report.json").read_text())
            self.assertEqual("valid", parity["status"])
            self.assertEqual(0.01, parity["horizontal_tolerance_ft"])
            self.assertEqual([], parity["mismatches"])
            self.assertTrue(parity["pdf"]["vector_paths_present"])
            self.assertTrue(parity["pdf"]["text_extractable"])

            ogr = subprocess.run(
                [str(QGIS_BIN / "ogrinfo"), "-json", "-features", str(output / "hilyard-site-layout.gpkg"), "canonical_polygons"],
                text=True, capture_output=True,
            )
            self.assertEqual(0, ogr.returncode, ogr.stderr)
            gpkg = json.loads(ogr.stdout)
            gpkg_ids = {row["properties"]["id"] for row in gpkg["layers"][0]["features"]}
            self.assertIn("building-apartment-1", gpkg_ids)
            self.assertIn("constraint-wetland", gpkg_ids)


if __name__ == "__main__":
    unittest.main()
