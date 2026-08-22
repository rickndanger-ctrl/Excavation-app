import unittest
from pathlib import Path

from civil_plan_factory.io import load_project_bundle


ROOT = Path(__file__).parents[1]
PROJECT = ROOT / "projects" / "hilyard" / "project.json"
DISCLAIMER = "FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION"


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
        self.assertEqual("phase-07-finish-site", by_id["building-apartment-1"]["phase_id"])
        self.assertEqual("phase-07-finish-site", by_id["sidewalk-south-entry"]["phase_id"])

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


if __name__ == "__main__":
    unittest.main()
