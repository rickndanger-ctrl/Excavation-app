import copy
import json
import unittest
from pathlib import Path

from civil_plan_factory.io import load_project_bundle
from civil_plan_factory.validation import validate_model


ROOT = Path(__file__).parents[1]
PROJECT = ROOT / "projects" / "hilyard" / "project.json"


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.model = load_project_bundle(PROJECT)

    def errors_for(self, model):
        return [issue.code for issue in validate_model(model) if issue.severity == "error"]

    def test_frozen_hilyard_foundation_satisfies_contract(self):
        self.assertEqual([], self.errors_for(self.model))

    def test_rejects_missing_disclaimer_crs_units_and_datum(self):
        broken = copy.deepcopy(self.model)
        del broken["project"]["disclaimer"]
        del broken["spatial_reference"]["horizontal_crs"]
        del broken["spatial_reference"]["horizontal_units"]
        del broken["spatial_reference"]["vertical_datum"]
        self.assertEqual(
            {"disclaimer.missing", "crs.missing", "units.missing", "datum.missing"},
            set(self.errors_for(broken)),
        )

    def test_rejects_invalid_polygon_geometry(self):
        broken = copy.deepcopy(self.model)
        broken["features"]["polygons"] = [{
            "id": "bad-polygon",
            "feature_type": "property_limit",
            "layer_id": "property",
            "phase_id": "existing",
            "label": "Open polygon",
            "coordinates": [[0, 0], [10, 0], [10, 10]],
            "provenance": {"status": "confirmed", "source_ids": ["src-rfp-appendix"]},
        }]
        self.assertIn("geometry.polygon_invalid", self.errors_for(broken))

    def test_rejects_network_endpoint_that_does_not_resolve(self):
        broken = copy.deepcopy(self.model)
        broken["networks"][0]["edges"] = [{
            "id": "san-edge-1",
            "from_node_id": "missing-node",
            "to_node_id": "san-node-known",
            "geometry_feature_id": None,
            "provenance": {"status": "unknown", "source_ids": [], "unavailable_reason": "Tie-in unknown"},
        }]
        self.assertIn("network.endpoint_unresolved", self.errors_for(broken))

    def test_rejects_feature_without_complete_provenance(self):
        broken = copy.deepcopy(self.model)
        broken["features"]["points"] = [{
            "id": "point-1",
            "feature_type": "control_point",
            "layer_id": "control",
            "phase_id": "existing",
            "label": "Test point",
            "coordinates": [1, 2, 3],
            "provenance": {"status": "confirmed", "source_ids": []},
        }]
        self.assertIn("provenance.source_required", self.errors_for(broken))

    def test_rejects_invalid_or_duplicate_stable_ids(self):
        broken = copy.deepcopy(self.model)
        broken["layers"][0]["id"] = "Bad ID"
        broken["layers"][1]["id"] = broken["layers"][2]["id"]
        errors = self.errors_for(broken)
        self.assertIn("id.invalid", errors)
        self.assertIn("id.duplicate", errors)

    def test_rejects_unresolved_layer_reference(self):
        broken = copy.deepcopy(self.model)
        broken["features"]["points"] = [{
            "id": "point-1",
            "feature_type": "control_point",
            "layer_id": "missing-layer",
            "phase_id": "existing",
            "label": "Test point",
            "coordinates": [1, 2, 3],
            "provenance": {"status": "confirmed", "source_ids": ["src-rfp-appendix"]},
        }]
        self.assertIn("reference.unresolved", self.errors_for(broken))

    def test_rejects_missing_required_contract_coverage(self):
        broken = copy.deepcopy(self.model)
        broken["contract_coverage"] = [
            row for row in broken["contract_coverage"] if row["system"] != "telecom_fiber"
        ]
        self.assertIn("coverage.missing_system", self.errors_for(broken))

    def test_rejects_tampered_locked_source_checksum(self):
        broken = copy.deepcopy(self.model)
        source = next(row for row in broken["sources"] if row["id"] == "src-project-brief")
        source["lock"]["sha256"] = "0" * 64
        self.assertIn("source.lock_mismatch", self.errors_for(broken))

    def test_versioned_json_schemas_are_valid_json(self):
        schema_paths = sorted((ROOT / "schemas" / "v0.1.0").glob("*.schema.json"))
        self.assertGreaterEqual(len(schema_paths), 3)
        for path in schema_paths:
            schema = json.loads(path.read_text())
            self.assertEqual("https://json-schema.org/draft/2020-12/schema", schema["$schema"])
            self.assertIn("/v0.1.0/", schema["$id"])


if __name__ == "__main__":
    unittest.main()
