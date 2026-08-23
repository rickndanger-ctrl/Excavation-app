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


class GradingSitePrepModelTests(unittest.TestCase):
    def setUp(self):
        self.model = load_project_bundle(PROJECT)
        self.points = {row["id"]: row for row in self.model["features"]["points"]}
        self.lines = {row["id"]: row for row in self.model["features"]["lines"]}
        self.polygons = {row["id"]: row for row in self.model["features"]["polygons"]}
        self.surfaces = {row["id"]: row for row in self.model["features"]["surfaces"]}

    def error_codes(self, model):
        return {issue.code for issue in validate_model(model) if issue.severity == "error"}

    def test_grading_is_surface_geometry_not_a_network(self):
        self.assertFalse(any(row["system"] == "grading" for row in self.model["networks"]))
        self.assertIn("surface-existing-grade-reference", self.surfaces)
        self.assertIn("surface-proposed-grade", self.surfaces)
        self.assertIn("surface-building-subgrade", self.surfaces)

    def test_existing_surface_is_reference_grade_and_replaceable(self):
        surface = self.surfaces["surface-existing-grade-reference"]
        self.assertEqual("reference-derived", surface["provenance"]["status"])
        self.assertFalse(surface["field_detail"]["survey_authority"])
        self.assertEqual("reference_grade_for_product_testing_only", surface["field_detail"]["fitness_for_use"])
        self.assertIn("Replace with surveyed topography", surface["field_detail"]["replacement_note"])

    def test_ngvd29_contours_are_explicitly_converted_to_navd88(self):
        basis = self.model["grading_basis"]
        conversion = basis["vertical_conversion"]
        self.assertEqual("NGVD29", conversion["source_datum"])
        self.assertEqual("NAVD88", conversion["target_datum"])
        self.assertEqual("NOAA VDatum / VERTCON 3.0", conversion["method"])
        self.assertAlmostEqual(3.698, conversion["applied_shift_ft"], places=3)
        self.assertEqual(0.165, conversion["reported_uncertainty_ft"])
        self.assertLessEqual(conversion["parcel_shift_range_ft"], 0.004)
        existing = [row for row in self.lines.values() if row["feature_type"] == "existing_contour_reference"]
        self.assertEqual(6, len(existing))
        for contour in existing:
            detail = contour["field_detail"]
            self.assertEqual("NGVD29", detail["source_vertical_datum"])
            self.assertEqual("NAVD88", detail["model_vertical_datum"])
            self.assertAlmostEqual(detail["source_elevation_ft"] + conversion["applied_shift_ft"], detail["elevation_ft"], places=6)
            self.assertIn("NGVD29", contour["label"])
            self.assertIn("NAVD88", contour["label"])

    def test_proposed_surface_spots_contours_and_breaklines_share_one_basis(self):
        proposed = self.surfaces["surface-proposed-grade"]
        self.assertEqual("NAVD88", proposed["vertical_datum"])
        self.assertEqual(8, len(proposed["field_detail"]["elevation_samples"]))
        contour_ids = proposed["field_detail"]["contour_ids"]
        self.assertEqual(2, len(contour_ids))
        self.assertNotIn("proposed-contour-445-00", contour_ids)
        for contour_id in contour_ids:
            contour = self.lines[contour_id]
            self.assertEqual("surface-proposed-grade", contour["field_detail"]["source_surface_id"])
            self.assertGreater(contour["field_detail"]["elevation_ft"], 0)
        self.assertEqual("surface-proposed-grade", self.lines["grade-break-pad-01"]["field_detail"]["source_surface_id"])

    def test_spot_elevations_preserve_ffe_freeboard_and_drainage_arrows(self):
        for spot_id in ("grade-spot-building-sw", "grade-spot-building-se", "grade-spot-building-ne", "grade-spot-building-nw"):
            detail = self.points[spot_id]["field_detail"]
            self.assertLess(detail["elevation_ft"], 445.0)
            self.assertGreaterEqual(detail["ffe_freeboard_ft"], 0.4)
        arrows = [row for row in self.lines.values() if row["feature_type"] == "surface_drainage_arrow"]
        self.assertEqual(3, len(arrows))
        self.assertTrue(all(row["field_detail"]["downhill"] for row in arrows))

    def test_cut_fill_quantities_are_withheld_without_a_complete_existing_tin(self):
        earthwork = self.model["earthwork_summary"]
        self.assertEqual("withheld_pending_survey_surface", earthwork["quantity_status"])
        self.assertFalse(earthwork["survey_to_surface_volume"])
        for feature_id in ("earthwork-fill-pad-01", "earthwork-cut-east-01"):
            detail = self.polygons[feature_id]["field_detail"]
            self.assertEqual("unknown_pending_complete_existing_tin", detail["classification_status"])
            self.assertNotIn("average_depth_ft", detail)
            self.assertNotIn("volume_cy", detail)

    def test_site_prep_uses_temporary_phase_and_separate_areas(self):
        for feature_id in ("site-prep-disturbance-limit-01", "site-prep-construction-entrance-01", "site-prep-stockpile-01"):
            self.assertEqual("phase-02-clearing-site-prep", self.polygons[feature_id]["phase_id"])
        self.assertEqual("phase-02-clearing-site-prep", self.lines["erosion-silt-fence-01"]["phase_id"])

    def test_validator_rejects_missing_surface_samples_fabricated_volume_and_fake_survey_claim(self):
        missing = copy.deepcopy(self.model)
        next(row for row in missing["features"]["surfaces"] if row["id"] == "surface-proposed-grade")["field_detail"]["elevation_samples"] = []
        self.assertIn("grading.surface_samples_missing", self.error_codes(missing))
        fabricated_volume = copy.deepcopy(self.model)
        next(row for row in fabricated_volume["features"]["polygons"] if row["id"] == "earthwork-fill-pad-01")["field_detail"]["volume_cy"] = 999
        self.assertIn("grading.earthwork_quantity_must_be_withheld", self.error_codes(fabricated_volume))
        fake_survey = copy.deepcopy(self.model)
        next(row for row in fake_survey["features"]["surfaces"] if row["id"] == "surface-existing-grade-reference")["field_detail"]["survey_authority"] = True
        self.assertIn("grading.unsupported_survey_claim", self.error_codes(fake_survey))

    def test_semantic_package_exposes_true_surfaces_contours_spots_and_areas(self):
        semantic = build_semantic_manifest(self.model)
        self.assertTrue({"surface-existing-grade-reference", "surface-proposed-grade", "surface-building-subgrade"}.issubset({row["id"] for row in semantic["surfaces"]}))
        self.assertIn("proposed-contour-444-50", {row["id"] for row in semantic["linearFeatures"]})
        self.assertIn("grade-spot-building-sw", {row["id"] for row in semantic["objects"]})
        self.assertIn("earthwork-fill-pad-01", {row["id"] for row in semantic["areas"]})

    def test_all_previous_network_values_remain_regression_locked(self):
        networks = {row["system"]: row for row in self.model["networks"]}
        self.assertEqual(439.70, networks["sanitary"]["edges"][0]["field_detail"]["upstream_invert_ft"])
        self.assertEqual(442.4, networks["storm"]["edges"][0]["field_detail"]["upstream_invert_ft"])
        self.assertEqual(2, networks["domestic_water"]["edges"][0]["field_detail"]["diameter_in"])
        self.assertEqual(3, networks["power"]["edges"][0]["field_detail"]["conduit_or_pipe_count"])


class GradingSitePrepBuildTests(unittest.TestCase):
    def test_build_emits_grading_site_prep_sheets_and_real_geometry_parity(self):
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
            self.assertIn("MASS EXCAVATION, BUILDING PAD, EARTHWORK, AND ROUGH GRADING", page_text[3])
            self.assertIn("CLEARING, STRIPPING, TEMPORARY ACCESS, AND SITE PREPARATION", page_text[2])
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
