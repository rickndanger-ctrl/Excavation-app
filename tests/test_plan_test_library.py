import json
import unittest
from pathlib import Path

from civil_plan_factory.export import build_semantic_manifest
from civil_plan_factory.io import load_project_bundle
from civil_plan_factory.validation import SAFETY_NOTICE, validate_model


ROOT = Path(__file__).parents[1]
CATALOG = ROOT / "projects" / "test-library-catalog.json"


class CivilPlanTestLibraryTests(unittest.TestCase):
    def test_catalog_defines_ten_meaningfully_varied_complete_packages(self):
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        self.assertEqual(10, len(catalog["packages"]))
        self.assertEqual(
            {
                "apartment_complex",
                "small_retail_center",
                "mixed_use_building",
                "medical_office_pad",
                "industrial_flex_site",
                "sloped_retaining_site",
                "flat_stormwater_site",
                "multi_building_residential",
                "compact_infill_site",
                "phased_commercial_site",
            },
            {row["archetype"] for row in catalog["packages"]},
        )

        models = []
        for row in catalog["packages"]:
            model = load_project_bundle(ROOT / "projects" / row["slug"] / "project.json")
            models.append(model)
            errors = [issue for issue in validate_model(model) if issue.severity == "error"]
            self.assertEqual([], errors, row["slug"])
            self.assertEqual(7, len(model["phases"]), row["slug"])
            self.assertGreaterEqual(len(model["layers"]), 9, row["slug"])
            self.assertEqual(row["archetype"], model["fixture_profile"]["archetype"])
            self.assertTrue(model["fixture_profile"]["variation_summary"])
            self.assertEqual(SAFETY_NOTICE, build_semantic_manifest(model)["safetyNotice"])
            if row["slug"] != "hilyard":
                self.assertNotEqual(
                    "custom_semantic_design",
                    model["project"].get("authoring_mode"),
                    "paused transformed fixtures must not inherit original-plan authority",
                )
                self.assertNotIn("authoring_contract", model)
                self.assertNotIn("geometry_origin_receipt", model)

        project_ids = {model["project"]["id"] for model in models}
        self.assertEqual(10, len(project_ids))
        building_counts = []
        orientations = []
        for model in models:
            buildings = [
                row for row in model["features"]["polygons"]
                if row.get("feature_type") == "building"
            ]
            building_counts.append(len(buildings))
            orientations.append(model["fixture_profile"]["site_orientation_degrees"])
        self.assertGreaterEqual(len(set(building_counts)), 3)
        self.assertGreaterEqual(len(set(orientations)), 5)


if __name__ == "__main__":
    unittest.main()
