import json
from pathlib import Path
import tempfile
import unittest

from civil_plan_factory.build import geometry_digest
from civil_plan_factory.io import load_project_bundle
from civil_plan_factory.studio import StudioWorkspace
from civil_plan_factory.validation import DISCLAIMER, validate_model


ROOT = Path(__file__).resolve().parents[1]
HILYARD = ROOT / "projects/hilyard/project.json"
CASCADE = ROOT / "projects/cascade-commerce/project.json"


class CascadeCommerceRegressionTests(unittest.TestCase):
    def test_controlled_commercial_site_is_materially_distinct_and_valid(self):
        hilyard = load_project_bundle(HILYARD)
        cascade = load_project_bundle(CASCADE)
        polygons = {row["id"]: row for row in cascade["features"]["polygons"]}
        systems = {row["system"]: row for row in cascade["networks"]}

        self.assertEqual([], [issue.to_dict() for issue in validate_model(cascade)])
        self.assertEqual(DISCLAIMER, cascade["disclaimer"])
        self.assertEqual(DISCLAIMER, cascade["project"]["disclaimer"])
        self.assertEqual("commercial_service_warehouse", cascade["site_basis"]["use_pattern"])
        self.assertNotEqual(geometry_digest(hilyard), geometry_digest(cascade))
        self.assertGreater(len(polygons["property-commerce-boundary"]["coordinates"]), 6)
        self.assertGreater(len(polygons["building-commercial-1"]["coordinates"]), 6)
        self.assertNotEqual(
            len(next(row for row in hilyard["networks"] if row["system"] == "storm")["edges"]),
            len(systems["storm"]["edges"]),
        )
        statuses = {
            row["provenance_status"] for row in cascade["sources"]
        } | {row["status"] for row in cascade["decisions"]}
        self.assertTrue({"confirmed", "reference-derived", "reviewed_assumption", "unknown"} <= statuses)

    def test_controlled_site_runs_publishes_and_names_its_own_field_map_package(self):
        with tempfile.TemporaryDirectory() as state:
            workspace = StudioWorkspace(ROOT, state_root=Path(state))
            run = workspace.run_project("cascade-commerce")
            publication = workspace.publish("cascade-commerce", run["run_id"])

            self.assertEqual("ready", run["publication_readiness"])
            self.assertIn("cascade-commerce-site.pdf", run["artifacts"])
            self.assertIn("cascade-commerce-site.gpkg", run["artifacts"])
            semantic = json.loads(Path(publication["import_file"]).read_text())
            self.assertEqual("cascade-commerce-site.pdf", semantic["plan"]["imageUrl"])
            self.assertEqual(DISCLAIMER, semantic["disclaimer"])


if __name__ == "__main__":
    unittest.main()
