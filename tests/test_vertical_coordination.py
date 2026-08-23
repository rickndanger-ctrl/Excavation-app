import copy
import math
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader

from civil_plan_factory.build import create_vector_plan, field_contract_digest, geometry_digest
from civil_plan_factory.export import build_semantic_manifest
from civil_plan_factory.io import load_project_bundle
from civil_plan_factory.validation import validate_model


ROOT = Path(__file__).parents[1]
PROJECT = ROOT / "projects" / "hilyard" / "project.json"


class WholeJobVerticalCoordinationTests(unittest.TestCase):
    def setUp(self):
        self.model = load_project_bundle(PROJECT)
        self.features = {
            feature["id"]: feature
            for group in ("points", "lines", "polygons", "surfaces")
            for feature in self.model["features"][group]
        }

    def error_codes(self, model):
        return {
            issue.code
            for issue in validate_model(model)
            if issue.severity == "error"
        }

    def test_one_reviewed_vertical_basis_controls_the_entire_finished_job(self):
        self.assertIn("vertical_design_basis", self.model)
        basis = self.model["vertical_design_basis"]
        self.assertEqual("NAVD88", basis["vertical_datum"])
        self.assertEqual("feet", basis["units"])
        self.assertEqual("reviewed_assumption", basis["status"])
        self.assertEqual("unknown", basis["benchmark_status"])
        self.assertFalse(basis["survey_authority"])
        self.assertEqual(445.00, basis["finished_floor_elevation_ft"])
        self.assertEqual(443.50, basis["building_subgrade_elevation_ft"])
        self.assertEqual(
            {
                "origin_feature_id": "paving-arrival-court",
                "origin_vertex_index": 0,
                "origin_elevation_ft": 443.80,
                "rise_per_foot_local_x": 0.005,
                "rise_per_foot_local_y": 0.01,
                "drainage_direction": "toward_vertex_0_southwest",
                "low_point_outfall_status": "unknown_pending_final_drainage_design",
            },
            basis["arrival_court_plane"],
        )

        finished = [
            feature
            for feature in self.features.values()
            if feature["phase_id"] == "phase-07-finish-site"
        ]
        self.assertGreaterEqual(len(finished), 19)
        for feature in finished:
            detail = feature["field_detail"]
            self.assertEqual("NAVD88", detail["vertical_datum"], feature["id"])
            self.assertEqual("reviewed_assumption", detail["vertical_status"], feature["id"])
            self.assertTrue(
                any(
                    key in detail
                    for key in (
                        "finished_floor_elevation_ft",
                        "threshold_elevation_ft",
                        "vertical_profile",
                        "grade_controls",
                    )
                ),
                feature["id"],
            )

    def test_arrival_court_parking_and_curb_share_one_mathematical_plane(self):
        self.assertIn("vertical_design_basis", self.model)
        plane = self.model["vertical_design_basis"]["arrival_court_plane"]
        origin_x, origin_y = self.features[plane["origin_feature_id"]]["coordinates"][plane["origin_vertex_index"]]

        for feature_id in (
            "paving-arrival-court",
            "drive-aisle-arrival-01",
            "parking-stall-01",
            "parking-stall-02",
            "parking-stall-03",
            "parking-stall-04",
            "parking-stall-05",
        ):
            feature = self.features[feature_id]
            controls = feature["field_detail"]["grade_controls"]
            self.assertEqual(4, len(controls), feature_id)
            for control in controls:
                x, y = feature["coordinates"][control["vertex_index"]]
                expected = (
                    plane["origin_elevation_ft"]
                    + (x - origin_x) * plane["rise_per_foot_local_x"]
                    + (y - origin_y) * plane["rise_per_foot_local_y"]
                )
                self.assertAlmostEqual(expected, control["elevation_ft"], places=3, msg=feature_id)

        curb = self.features["curb-arrival-court-01"]["field_detail"]
        self.assertEqual(0.50, curb["curb_reveal_ft"])
        for control in curb["grade_controls"]:
            self.assertAlmostEqual(
                control["gutter_elevation_ft"] + 0.50,
                control["top_of_curb_elevation_ft"],
                places=3,
            )

    def test_walks_ramps_and_entries_tie_to_the_ffe_without_uphill_drainage(self):
        self.assertIn("vertical_design_basis", self.model)
        ffe = self.model["vertical_design_basis"]["finished_floor_elevation_ft"]
        for entry_id in ("entry-south-primary", "entry-east-service", "entry-north-pedestrian"):
            detail = self.features[entry_id]["field_detail"]
            self.assertEqual(ffe, detail["threshold_elevation_ft"])
            self.assertEqual(444.98, detail["exterior_landing_elevation_ft"])

        expected_profiles = {
            "sidewalk-south-entry": (444.98, 444.82, 10.5, 1.52381),
            "sidewalk-north-entry": (444.98, 444.63, 23.5, 1.489362),
            "sidewalk-east-service": (444.98, 444.79, 12.5, 1.52),
            "sidewalk-arrival-link": (444.82, 444.45, 24.5, 1.510204),
            "curb-ramp-arrival-01": (444.45, 444.11, 5.0, 6.8),
        }
        for feature_id, (high, low, run, slope) in expected_profiles.items():
            profile = self.features[feature_id]["field_detail"]["vertical_profile"]
            self.assertEqual(high, profile["high_elevation_ft"], feature_id)
            self.assertEqual(low, profile["low_elevation_ft"], feature_id)
            self.assertEqual(run, profile["run_ft"], feature_id)
            self.assertAlmostEqual(slope, profile["slope_percent"], places=5, msg=feature_id)
            self.assertAlmostEqual((high - low) / run * 100.0, slope, places=5, msg=feature_id)

        pad = self.features["pad-apartment-1"]["field_detail"]
        self.assertEqual(
            [444.38, 444.33, 444.43, 444.48],
            [control["elevation_ft"] for control in pad["perimeter_grade_controls"]],
        )
        self.assertEqual(1.5, ffe - pad["subgrade_elevation_ft"])
        building = self.features["building-apartment-1"]["field_detail"]
        self.assertNotIn("adjacent_finish_grade_range_ft", building)
        self.assertEqual([444.45, 444.60], building["non_entry_perimeter_grade_range_ft"])

    def test_proposed_surface_covers_the_finished_job_and_has_no_false_ffe_contour(self):
        surface = self.features["surface-proposed-grade"]
        surface_x = [point[0] for point in surface["boundary"]]
        surface_y = [point[1] for point in surface["boundary"]]
        finished_points = [
            point
            for feature in self.features.values()
            if feature["phase_id"] == "phase-07-finish-site"
            for point in (
                [feature["coordinates"]]
                if isinstance(feature.get("coordinates", [None])[0], (int, float))
                else feature.get("coordinates", [])
            )
        ]
        self.assertTrue(finished_points)
        self.assertLessEqual(min(surface_x), min(point[0] for point in finished_points))
        self.assertGreaterEqual(max(surface_x), max(point[0] for point in finished_points))
        self.assertLessEqual(min(surface_y), min(point[1] for point in finished_points))
        self.assertGreaterEqual(max(surface_y), max(point[1] for point in finished_points))

        sample_max = max(
            sample["elevation_ft"]
            for sample in surface["field_detail"]["elevation_samples"]
        )
        contours = [
            feature
            for feature in self.features.values()
            if feature["feature_type"] == "proposed_contour"
        ]
        self.assertTrue(all(contour["field_detail"]["elevation_ft"] <= sample_max for contour in contours))
        self.assertEqual(
            {"proposed-contour-444-00", "proposed-contour-444-50"},
            {contour["id"] for contour in contours},
        )

    def test_north_walk_clears_the_planter_and_planter_storage_has_vertical_endpoints(self):
        walk = self.features["sidewalk-north-entry"]["coordinates"]
        planter = self.features["storm-planter-01"]["coordinates"]

        def bounds(ring):
            return (
                min(point[0] for point in ring),
                min(point[1] for point in ring),
                max(point[0] for point in ring),
                max(point[1] for point in ring),
            )

        walk_min_x, walk_min_y, walk_max_x, walk_max_y = bounds(walk)
        planter_min_x, planter_min_y, planter_max_x, planter_max_y = bounds(planter)
        interiors_overlap = (
            walk_min_x < planter_max_x
            and walk_max_x > planter_min_x
            and walk_min_y < planter_max_y
            and walk_max_y > planter_min_y
        )
        self.assertFalse(interiors_overlap)

        detail = self.features["storm-planter-01"]["field_detail"]
        self.assertEqual(441.60, detail["bed_elevation_ft"])
        self.assertEqual(442.85, detail["overflow_crest_elevation_ft"])
        self.assertEqual(444.10, detail["rim_elevation_ft"])
        self.assertEqual(
            detail["surface_storage_depth_ft"],
            detail["overflow_crest_elevation_ft"] - detail["bed_elevation_ft"],
        )
        self.assertEqual(500.0, detail["declared_surface_storage_cf"])

    def test_unreliable_earthwork_quantities_are_withheld_until_a_complete_existing_tin_exists(self):
        summary = self.model["earthwork_summary"]
        self.assertEqual("withheld_pending_survey_surface", summary["quantity_status"])
        self.assertFalse(summary["survey_to_surface_volume"])
        self.assertNotIn("cut_cy", summary)
        self.assertNotIn("fill_cy", summary)
        self.assertNotIn("net_import_cy", summary)
        for feature_id in ("earthwork-fill-pad-01", "earthwork-cut-east-01"):
            detail = self.features[feature_id]["field_detail"]
            self.assertEqual("unknown_pending_complete_existing_tin", detail["classification_status"])
            self.assertNotIn("volume_cy", detail)

    def test_public_utility_source_lengths_are_not_confused_with_mapped_geometry(self):
        edges = {
            edge["id"]: edge
            for network in self.model["networks"]
            for edge in network.get("edges", [])
        }
        for edge_id in ("san-edge-public-upstream", "san-edge-public-downstream"):
            detail = edges[edge_id]["field_detail"]
            self.assertEqual(237.0, detail["source_reported_total_length_ft"])
            self.assertAlmostEqual(0.59100002, detail["source_reported_slope_percent"], places=8)
            self.assertEqual(214.921, detail["canonical_geometry_total_length_ft"])
            self.assertAlmostEqual(
                (detail["upstream_invert_ft"] - detail["downstream_invert_ft"])
                / detail["length_ft"] * 100.0,
                detail["slope_percent"],
                places=6,
            )

        storm = edges["storm-edge-public-main-4183"]["field_detail"]
        self.assertEqual(100.0, storm["source_reported_length_ft"])
        self.assertAlmostEqual(141.321973, storm["source_shape_length_ft"], places=6)
        self.assertAlmostEqual(141.323413, storm["length_ft"], places=6)
        self.assertAlmostEqual(0.66, storm["source_record_length_derived_slope_percent"], places=6)
        self.assertAlmostEqual(
            (storm["upstream_invert_ft"] - storm["downstream_invert_ft"])
            / storm["length_ft"] * 100.0,
            storm["slope_percent"],
            places=6,
        )

    def test_pressure_and_dry_utilities_have_absolute_profiles_from_finished_surface(self):
        networks = {network["id"]: network for network in self.model["networks"]}
        basis = self.model["vertical_design_basis"]
        self.assertEqual(
            "reviewed_assumption_absolute_profiles_from_finished_surface",
            basis["pressure_and_dry_utility_vertical_status"],
        )

        pressure_edges = [
            edge
            for network_id in ("network-domestic-water", "network-fire-water", "network-gas")
            for edge in networks[network_id]["edges"]
        ]
        for edge in pressure_edges:
            detail = edge["field_detail"]
            self.assertEqual("NAVD88", detail["vertical_datum"])
            self.assertEqual("surface-proposed-grade", detail["surface_id"])
            self.assertEqual("finished_surface_to_pipe_crown", detail["cover_reference"])
            self.assertEqual(2, len(detail["surface_samples_ft"]))
            self.assertEqual(2, len(detail["centerline_elevation_samples_ft"]))
            pipe_radius_ft = detail.get("diameter_in", detail.get("conduit_or_pipe_size_in")) / 24.0
            for surface, centerline, cover in zip(
                detail["surface_samples_ft"],
                detail["centerline_elevation_samples_ft"],
                detail["cover_samples_ft"],
            ):
                self.assertAlmostEqual(
                    surface - (centerline + pipe_radius_ft),
                    cover,
                    places=5,
                    msg=edge["id"],
                )

        dry_edges = [
            edge
            for network_id in (
                "network-power",
                "network-telecom-fiber",
                "network-site-lighting",
            )
            for edge in networks[network_id]["edges"]
        ]
        for edge in dry_edges:
            detail = edge["field_detail"]
            self.assertEqual("NAVD88", detail["vertical_datum"])
            self.assertEqual("surface-proposed-grade", detail["surface_id"])
            self.assertEqual("finished_surface_to_top_of_utility", detail["cover_reference"])
            for surface, utility_top in zip(
                detail["surface_samples_ft"],
                detail["utility_top_elevation_samples_ft"],
            ):
                self.assertAlmostEqual(
                    surface - utility_top,
                    detail["modeled_cover_ft"],
                    places=5,
                    msg=edge["id"],
                )

        semantic = build_semantic_manifest(self.model)
        utilities = {utility["id"]: utility for utility in semantic["utilities"]}
        self.assertEqual(
            [440.396667, 440.516667],
            utilities["dom-edge-tie-meter"]["fieldDetail"]["centerline_elevation_samples_ft"],
        )
        self.assertEqual(
            "FG 443.98-444.10 / CL 440.40-440.52 / COVER 3.50 FT",
            utilities["dom-edge-tie-meter"]["fieldDetail"]["vertical_callout"],
        )
        self.assertEqual(
            [441.05, 441.30],
            utilities["power-edge-poc-vault"]["fieldDetail"]["utility_top_elevation_samples_ft"],
        )
        self.assertEqual(
            "FG 444.05-444.30 / TOP 441.05-441.30 / COVER 3.00 FT",
            utilities["power-edge-poc-vault"]["fieldDetail"]["vertical_callout"],
        )

    def test_vertical_validator_fails_closed_on_datum_plane_entry_and_slope_drift(self):
        self.assertIn("vertical_design_basis", self.model)
        cases = []

        wrong_datum = copy.deepcopy(self.model)
        wrong_datum["vertical_design_basis"]["vertical_datum"] = "LOCAL"
        cases.append((wrong_datum, "vertical.datum_mismatch"))

        wrong_plane = copy.deepcopy(self.model)
        next(
            feature
            for feature in wrong_plane["features"]["polygons"]
            if feature["id"] == "parking-stall-03"
        )["field_detail"]["grade_controls"][0]["elevation_ft"] += 1.0
        cases.append((wrong_plane, "vertical.arrival_plane_mismatch"))

        wrong_entry = copy.deepcopy(self.model)
        next(
            feature
            for feature in wrong_entry["features"]["points"]
            if feature["id"] == "entry-south-primary"
        )["field_detail"]["threshold_elevation_ft"] = 444.0
        cases.append((wrong_entry, "vertical.entry_ffe_mismatch"))

        wrong_slope = copy.deepcopy(self.model)
        next(
            feature
            for feature in wrong_slope["features"]["polygons"]
            if feature["id"] == "sidewalk-north-entry"
        )["field_detail"]["vertical_profile"]["slope_percent"] = 0.1
        cases.append((wrong_slope, "vertical.profile_slope_mismatch"))

        wrong_utility = copy.deepcopy(self.model)
        next(
            edge
            for network in wrong_utility["networks"]
            if network["id"] == "network-domestic-water"
            for edge in network["edges"]
            if edge["id"] == "dom-edge-tie-meter"
        )["field_detail"]["centerline_elevation_samples_ft"][0] += 1.0
        cases.append((wrong_utility, "vertical.utility_cover_mismatch"))

        for broken, expected_code in cases:
            self.assertIn(expected_code, self.error_codes(broken), expected_code)

    def test_semantic_package_and_pdf_expose_the_same_vertical_controls(self):
        semantic = build_semantic_manifest(self.model)
        self.assertEqual(
            self.model["vertical_design_basis"],
            semantic["verticalDesignBasis"],
        )
        semantic_features = {
            feature["id"]: feature
            for group in ("objects", "linearFeatures", "areas", "surfaces")
            for feature in semantic[group]
        }
        self.assertIn("vertical_callout", semantic_features["sidewalk-south-entry"]["fieldDetail"])
        self.assertEqual(
            "FG 444.82-444.98 / SLOPE 1.52%",
            semantic_features["sidewalk-south-entry"]["fieldDetail"]["vertical_callout"],
        )
        self.assertEqual(
            "FFE 445.00 / PAD SG 443.50",
            semantic_features["building-apartment-1"]["fieldDetail"]["vertical_callout"],
        )

        with tempfile.TemporaryDirectory() as directory:
            pdf_path = Path(directory) / "hilyard.pdf"
            create_vector_plan(self.model, pdf_path, geometry_digest(self.model))
            pages = PdfReader(pdf_path).pages
            grading = pages[3].extract_text() or ""
            finished = pages[7].extract_text() or ""
            for text in (grading, finished):
                self.assertIn("VERTICAL DATUM: NAVD88", text)
                self.assertIn("BENCHMARK: UNKNOWN", text)
            self.assertIn("FG 444.50 NAVD88 - SW building corner", grading)
            self.assertIn("FFE 445.00 / PAD SG 443.50", finished)
            self.assertIn("FG 443.80-444.50 / DRAINS SW", finished)

    def test_vertical_changes_are_covered_by_the_field_contract_digest(self):
        changed = copy.deepcopy(self.model)
        next(
            feature
            for feature in changed["features"]["polygons"]
            if feature["id"] == "building-apartment-1"
        )["field_detail"]["finished_floor_elevation_ft"] += 1.0
        self.assertEqual(geometry_digest(self.model), geometry_digest(changed))
        self.assertNotEqual(field_contract_digest(self.model), field_contract_digest(changed))

    def test_storm_and_sanitary_sheets_draw_real_profiles_from_canonical_edges(self):
        plans = {plan["sheet_number"]: plan for plan in self.model["deliverables"]["plans"]}
        self.assertEqual(
            [
                "storm-edge-roof-lateral-01",
                "storm-edge-planter-inlet-01",
                "storm-edge-planter-underdrain-01",
                "storm-edge-outlet-01",
                "storm-edge-public-connection-01",
            ],
            plans["C4.00"]["profile_edge_ids"],
        )
        self.assertEqual(
            ["san-edge-service-01", "san-edge-service-02"],
            plans["C5.00"]["profile_edge_ids"],
        )

        with tempfile.TemporaryDirectory() as directory:
            pdf_path = Path(directory) / "hilyard.pdf"
            create_vector_plan(self.model, pdf_path, geometry_digest(self.model))
            pages = PdfReader(pdf_path).pages
            for page_index, edge_ids in ((4, plans["C4.00"]["profile_edge_ids"]), (5, plans["C5.00"]["profile_edge_ids"])):
                text = pages[page_index].extract_text() or ""
                self.assertIn("CANONICAL GRAVITY PROFILE", text)
                self.assertIn("PROFILE DATUM", text)
                for edge_id in edge_ids:
                    self.assertIn(edge_id, text)

    def test_c6_utility_sheet_prints_absolute_vertical_profiles_for_every_proposed_route(self):
        plan = next(
            row for row in self.model["deliverables"]["plans"]
            if row["sheet_number"] == "C6.00"
        )
        route_ids = {
            edge["geometry_feature_id"]
            for network in self.model["networks"]
            if network["id"] in {
                "network-domestic-water",
                "network-fire-water",
                "network-power",
                "network-telecom-fiber",
                "network-gas",
                "network-site-lighting",
            }
            for edge in network["edges"]
        }
        self.assertTrue(route_ids.issubset(set(plan["asset_ids"])))

        with tempfile.TemporaryDirectory() as directory:
            pdf_path = Path(directory) / "hilyard.pdf"
            create_vector_plan(self.model, pdf_path, geometry_digest(self.model))
            text = PdfReader(pdf_path).pages[6].extract_text() or ""
            self.assertIn("domestic-water-seg-01", text)
            self.assertIn("FG 443.98-444.10 / CL 440.40-440.52 / COVER 3.50 FT", text)
            self.assertIn("power-route-01", text)
            self.assertIn("FG 444.05-444.30 / TOP 441.05-441.30 / COVER 3.00 FT", text)


if __name__ == "__main__":
    unittest.main()
