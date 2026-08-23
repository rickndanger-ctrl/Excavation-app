import math
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader

from civil_plan_factory.build import (
    create_vector_plan,
    field_contract_digest,
    geometry_digest,
)
from civil_plan_factory.export import build_semantic_manifest
from civil_plan_factory.golden_pdf import declutter_callout_positions
from civil_plan_factory.io import load_project_bundle


ROOT = Path(__file__).parents[1]
PROJECT = ROOT / "projects" / "hilyard" / "project.json"
DISCLAIMER = "FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION"
SAFETY_NOTICE = "FICTIONAL TEST DATA — NOT FOR CONSTRUCTION — NOT ENGINEERED OR PERMITTED"


class GoldenPlanPackageTests(unittest.TestCase):
    def setUp(self):
        self.model = load_project_bundle(PROJECT)

    def test_golden_apartment_uses_the_complete_field_construction_sequence(self):
        expected = [
            "phase-01-existing-control-erosion",
            "phase-02-clearing-site-prep",
            "phase-03-earthwork-rough-grading",
            "phase-04-storm",
            "phase-05-sanitary",
            "phase-06-water-dry-utilities",
            "phase-07-finish-site",
        ]
        self.assertEqual(expected, [phase["id"] for phase in self.model["phases"]])
        valid = set(expected)
        features = [
            feature
            for group in ("points", "lines", "polygons", "surfaces")
            for feature in self.model["features"][group]
        ]
        self.assertGreater(len(features), 100)
        self.assertTrue(all(feature["phase_id"] in valid for feature in features))

        by_id = {feature["id"]: feature for feature in features}
        self.assertEqual("phase-01-existing-control-erosion", by_id["taxlot-10900"]["phase_id"])
        self.assertEqual("phase-02-clearing-site-prep", by_id["site-prep-stockpile-01"]["phase_id"])
        self.assertEqual("phase-03-earthwork-rough-grading", by_id["pad-apartment-1"]["phase_id"])
        self.assertEqual("phase-04-storm", by_id["storm-site-drop-mh-01"]["phase_id"])
        self.assertEqual("phase-05-sanitary", by_id["sanitary-cleanout-01"]["phase_id"])
        self.assertEqual("phase-06-water-dry-utilities", by_id["domestic-water-meter-01"]["phase_id"])
        self.assertEqual("phase-06-water-dry-utilities", by_id["penetration-electric"]["phase_id"])
        self.assertEqual("phase-06-water-dry-utilities", by_id["dry-shared-trench-corridor-01"]["phase_id"])
        self.assertEqual("phase-07-finish-site", by_id["building-apartment-1"]["phase_id"])
        self.assertEqual("phase-07-finish-site", by_id["sidewalk-south-entry"]["phase_id"])

    def test_golden_apartment_is_an_original_custom_plan_package(self):
        expected = {
            "mode": "custom_semantic_design",
            "canonical_authority": "semantic_model",
            "deliverable_origin": "generated_from_canonical_model",
            "reference_material_policy": "context_and_conventions_only",
        }

        self.assertEqual("custom_semantic_design", self.model["project"]["authoring_mode"])
        self.assertEqual(expected, self.model["authoring_contract"])
        self.assertNotIn("reviewed_source_adapter", self.model)

        designed_features = [
            feature
            for group in ("points", "lines", "polygons", "surfaces")
            for feature in self.model["features"][group]
            if feature["phase_id"] != "phase-01-existing-control-erosion"
        ]
        self.assertGreater(len(designed_features), 100)
        self.assertNotIn(
            "reference-derived",
            {feature["provenance"]["status"] for feature in designed_features},
        )

        semantic = build_semantic_manifest(self.model)
        self.assertEqual(expected, semantic["authoringContract"])
        self.assertEqual("generated_vector_pdf", semantic["plan"]["availability"])
        self.assertEqual("hilyard-site-layout.pdf", semantic["plan"]["imageUrl"])

        changed = dict(self.model)
        changed["authoring_contract"] = {
            **expected,
            "reference_material_policy": "geometry_source",
        }
        self.assertNotEqual(
            field_contract_digest(self.model),
            field_contract_digest(changed),
        )

    def test_every_golden_sheet_and_semantic_package_carries_full_safety_notice(self):
        semantic = build_semantic_manifest(self.model)
        self.assertEqual(SAFETY_NOTICE, semantic["safetyNotice"])

        with tempfile.TemporaryDirectory() as output:
            pdf_path = Path(output) / "golden-apartment.pdf"
            create_vector_plan(self.model, pdf_path, geometry_digest(self.model))
            pages = PdfReader(pdf_path).pages
            self.assertGreater(len(pages), 1)
            for page_number, page in enumerate(pages, start=1):
                self.assertIn(
                    SAFETY_NOTICE,
                    page.extract_text(),
                    f"full safety notice missing from page {page_number}",
                )

    def test_golden_sheet_index_covers_every_phase_and_field_discipline(self):
        plans = self.model["deliverables"]["plans"]
        by_id = {plan["id"]: plan for plan in plans}
        expected = {
            "sheet-cover-index",
            "sheet-existing-control-erosion",
            "sheet-clearing-site-prep",
            "sheet-earthwork-rough-grading",
            "sheet-storm-plan-profile",
            "sheet-sanitary-plan-profile",
            "sheet-water-dry-utilities",
            "sheet-finish-site",
            "sheet-details-schedules",
        }
        self.assertEqual(expected, set(by_id))
        self.assertEqual(
            ["G0.00", "C1.00", "C2.00", "C3.00", "C4.00", "C5.00", "C6.00", "C7.00", "C8.00"],
            [plan["sheet_number"] for plan in plans],
        )
        phase_ids = {plan.get("phase_id") for plan in plans if plan.get("phase_id")}
        self.assertEqual({phase["id"] for phase in self.model["phases"]}, phase_ids)
        for plan in plans:
            self.assertEqual(DISCLAIMER, plan["disclaimer"])
            self.assertEqual("feet", plan["units"])
            self.assertTrue(plan["north_arrow"])
            self.assertTrue(plan["written_scale"])
            self.assertTrue(plan["graphic_scale_ft"])
            self.assertTrue(plan["legend_ids"])

        sections = {section["id"] for section in self.model["deliverables"]["sections"]}
        self.assertTrue({"section-utility-trench", "section-paving-curb-walk", "section-building-pad"}.issubset(sections))

    def test_generated_golden_pdf_matches_the_declared_sheet_contract(self):
        plans = self.model["deliverables"]["plans"]
        with tempfile.TemporaryDirectory() as output:
            pdf_path = Path(output) / "golden-apartment.pdf"
            create_vector_plan(self.model, pdf_path, geometry_digest(self.model))
            pages = PdfReader(pdf_path).pages

            self.assertEqual(len(plans), len(pages))
            page_text = [page.extract_text() or "" for page in pages]
            for plan, text, page in zip(plans, page_text, pages):
                self.assertIn(plan["sheet_number"], text)
                self.assertIn(plan["title"].upper(), text)
                self.assertIn(plan["written_scale"].upper(), text)
                self.assertIn("UNITS: FEET", text)
                self.assertIn(SAFETY_NOTICE, text)
                self.assertEqual([], list(page.images))
                for asset_id in plan["asset_ids"]:
                    if asset_id.startswith("network-"):
                        continue
                    self.assertIn(asset_id, text, f"{asset_id} missing from {plan['sheet_number']}")

            cover = page_text[0]
            for plan in plans:
                self.assertIn(plan["sheet_number"], cover)
                self.assertIn(plan["title"].upper(), cover)

    def test_golden_network_edges_expose_field_details_and_resolvable_topology(self):
        for network in self.model["networks"]:
            node_ids = {node["id"] for node in network["nodes"]}
            self.assertGreater(len(node_ids), 1, network["id"])
            for edge in network["edges"]:
                self.assertIn(edge["from_node_id"], node_ids, edge["id"])
                self.assertIn(edge["to_node_id"], node_ids, edge["id"])
                details = edge["field_detail"]
                self.assertGreater(details["length_ft"], 0, edge["id"])
                self.assertTrue(details.get("material"), edge["id"])
                if network["system"] in {"sanitary", "storm", "roof_drainage"}:
                    self.assertIn("upstream_invert_ft", details, edge["id"])
                    self.assertIn("downstream_invert_ft", details, edge["id"])
                    self.assertIn("slope_percent", details, edge["id"])

    def test_finished_site_is_a_complete_field_readable_base_not_a_disconnected_sample(self):
        finished = [
            feature
            for group in ("points", "lines", "polygons")
            for feature in self.model["features"][group]
            if feature["phase_id"] == "phase-07-finish-site"
        ]
        by_type = {}
        for feature in finished:
            by_type.setdefault(feature["feature_type"], []).append(feature)

        self.assertEqual(5, len(by_type.get("parking_stall", [])))
        for required_type in (
            "building",
            "drive_aisle",
            "fire_access_route",
            "curb_line",
            "curb_ramp",
            "pedestrian_flatwork",
            "landscape_area",
        ):
            self.assertTrue(by_type.get(required_type), required_type)

        finish_sheet = next(
            plan for plan in self.model["deliverables"]["plans"]
            if plan["sheet_number"] == "C7.00"
        )
        ids = {feature["id"] for feature in finished}
        self.assertTrue(ids.issubset(set(finish_sheet["asset_ids"])))

    def test_finished_site_pdf_uses_distinct_vector_symbology(self):
        with tempfile.TemporaryDirectory() as output:
            pdf_path = Path(output) / "golden-apartment.pdf"
            create_vector_plan(self.model, pdf_path, geometry_digest(self.model))
            page = PdfReader(pdf_path).pages[7]
            content = page.get_contents().get_data().decode("latin-1")
            for feature_type in ("parking_stall", "drive_aisle", "curb_line", "fire_access_route", "curb_ramp"):
                self.assertIn(f"%MS_STYLE {feature_type}", content)

    def test_callout_positions_keep_numbered_tags_legible(self):
        positions = declutter_callout_positions([(100.0, 100.0)] * 8, minimum_spacing=28.0)
        self.assertEqual(8, len(positions))
        for index, left in enumerate(positions):
            for right in positions[index + 1:]:
                self.assertGreaterEqual(math.dist(left, right), 28.0)


if __name__ == "__main__":
    unittest.main()
