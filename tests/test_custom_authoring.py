import copy
import json
from pathlib import Path
import tempfile
import unittest

from civil_plan_factory.custom_authoring import (
    CUSTOM_AUTHORING_CONTRACT,
    DEFAULT_DESIGN_BRIEF,
    PROFILE_ID,
    authored_bundle_sha256,
    brief_sha256,
    compile_profile,
    list_profiles,
    recipe_sha256,
    validate_design_brief,
)
from civil_plan_factory.export import build_semantic_manifest
from civil_plan_factory.validation import validate_model


ROOT = Path(__file__).resolve().parents[1]
PROFILES = ROOT / "profiles"
PROFILE = PROFILES / PROFILE_ID


class CustomAuthoringTests(unittest.TestCase):
    @staticmethod
    def _model_with_ledgers(project, sources, decisions):
        model = copy.deepcopy(project)
        model.pop("source_ledger", None)
        model.pop("decision_ledger", None)
        model["sources"] = copy.deepcopy(sources["sources"])
        model["decisions"] = copy.deepcopy(decisions["decisions"])
        return model

    def test_registered_profile_exposes_a_goal_first_default_brief(self):
        profiles = list_profiles(PROFILES)
        registered = next(row for row in profiles if row["profile_id"] == PROFILE_ID)

        self.assertEqual("goal", next(iter(registered["default_brief"])))
        self.assertEqual("1.0.0", registered["profile_version"])
        self.assertEqual(DEFAULT_DESIGN_BRIEF, registered["default_brief"])
        self.assertIn("finished job", registered["default_brief"]["goal"].lower())
        self.assertEqual(
            "apartment_complex",
            registered["default_brief"]["site_program"]["archetype"],
        )
        self.assertEqual(
            445.0,
            registered["default_brief"]["vertical_design"]["finished_floor_elevation_ft"],
        )
        self.assertEqual(
            "finished_site_first",
            registered["default_brief"]["presentation"]["base_view"],
        )

    def test_brief_allows_a_new_goal_but_rejects_unsupported_design_changes(self):
        profile = list_profiles(PROFILES)[0]
        goal_variant = copy.deepcopy(profile["default_brief"])
        goal_variant["goal"] = (
            "Give the earthwork crew one clear finished-job reference before "
            "excavation starts."
        )
        self.assertEqual(goal_variant, validate_design_brief(goal_variant, profile))

        browser_round_trip = copy.deepcopy(goal_variant)
        browser_round_trip["site_program"]["building_width_ft"] = 45
        browser_round_trip["site_program"]["building_length_ft"] = 90
        browser_round_trip["vertical_design"]["finished_floor_elevation_ft"] = 445
        normalized = validate_design_brief(browser_round_trip, profile)
        self.assertEqual(browser_round_trip["goal"], normalized["goal"])
        for section in ("site_program", "vertical_design", "presentation"):
            self.assertEqual(profile["default_brief"][section], normalized[section])

        boolean_dimension = copy.deepcopy(goal_variant)
        boolean_dimension["site_program"]["building_width_ft"] = True
        with self.assertRaisesRegex(ValueError, "unsupported"):
            validate_design_brief(boolean_dimension, profile)

        unsupported_changes = (
            ("site_program", "building_width_ft", 60.0),
            ("vertical_design", "finished_floor_elevation_ft", 446.0),
            ("presentation", "plan_scale", "1 inch = 10 feet"),
        )
        for section, key, value in unsupported_changes:
            with self.subTest(section=section, key=key):
                changed = copy.deepcopy(profile["default_brief"])
                changed[section][key] = value
                with self.assertRaisesRegex(ValueError, "unsupported"):
                    validate_design_brief(changed, profile)

        missing = copy.deepcopy(profile["default_brief"])
        missing.pop("presentation")
        with self.assertRaisesRegex(ValueError, "exactly match"):
            validate_design_brief(missing, profile)

    def test_brief_and_recipe_digests_are_deterministic_and_change_with_content(self):
        reordered = json.loads(json.dumps(DEFAULT_DESIGN_BRIEF, sort_keys=True))
        self.assertEqual(brief_sha256(DEFAULT_DESIGN_BRIEF), brief_sha256(reordered))
        changed_goal = copy.deepcopy(DEFAULT_DESIGN_BRIEF)
        changed_goal["goal"] += " Make the current phase unmistakable."
        self.assertNotEqual(brief_sha256(DEFAULT_DESIGN_BRIEF), brief_sha256(changed_goal))

        first = recipe_sha256(PROFILE)
        self.assertEqual(first, recipe_sha256(PROFILE))
        with tempfile.TemporaryDirectory() as temporary:
            copied = Path(temporary) / "profile"
            import shutil
            shutil.copytree(PROFILE, copied)
            metadata = json.loads((copied / "profile.json").read_text(encoding="utf-8"))
            metadata["description"] += " changed"
            (copied / "profile.json").write_text(
                json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
            )
            self.assertNotEqual(first, recipe_sha256(copied))

    def test_profile_compiles_an_original_consolidated_bundle_for_a_new_project(self):
        brief = copy.deepcopy(DEFAULT_DESIGN_BRIEF)
        brief["goal"] = "Show every employee the finished job before showing the work layers."
        project, sources, decisions = compile_profile(
            PROFILE,
            {"id": "field-demo-original", "name": "Field Demo Original"},
            brief,
        )

        self.assertEqual("field-demo-original", project["project"]["id"])
        self.assertEqual("Field Demo Original", project["project"]["name"])
        self.assertEqual(brief["goal"], project["project"]["goal"])
        self.assertEqual("custom_semantic_design", project["project"]["authoring_mode"])
        self.assertEqual(CUSTOM_AUTHORING_CONTRACT, project["authoring_contract"])
        self.assertNotIn("reviewed_source_adapter", project)
        self.assertNotIn("design_slices", project)
        self.assertNotIn("sources", project)
        self.assertNotIn("decisions", project)
        self.assertEqual("sources.lock.json", project["source_ledger"])
        self.assertEqual("decisions.json", project["decision_ledger"])
        self.assertEqual(PROFILE_ID, project["custom_authoring"]["profile_id"])
        self.assertEqual(brief_sha256(brief), project["custom_authoring"]["brief_sha256"])
        self.assertEqual(recipe_sha256(PROFILE), project["custom_authoring"]["recipe_sha256"])
        receipt = project["geometry_origin_receipt"]
        self.assertEqual(
            "civil-plan-factory.geometry-origin-receipt/v0.1.0",
            receipt["schema_version"],
        )
        self.assertEqual("registered_semantic_recipe", receipt["origin"])
        self.assertEqual(recipe_sha256(PROFILE), receipt["recipe_sha256"])
        self.assertEqual(
            ["phase-01-existing-control-erosion"],
            receipt["reference_context_phase_ids"],
        )
        self.assertGreater(receipt["authored_feature_count"], 100)
        self.assertRegex(receipt["authored_geometry_membership_sha256"], r"^[0-9a-f]{64}$")
        self.assertGreater(len(project["features"]["polygons"]), 20)
        self.assertEqual(7, len(project["phases"]))
        self.assertGreater(len(sources["sources"]), 10)
        self.assertGreater(len(decisions["decisions"]), 20)

        local_sources = [
            source for source in sources["sources"]
            if source.get("lock", {}).get("kind") == "local_file"
        ]
        self.assertTrue(local_sources)
        for source in local_sources:
            citation = Path(source["citation"])
            self.assertFalse(citation.is_absolute(), source["id"])
            self.assertEqual("project_bundle", source["citation_scope"])
            self.assertTrue((PROFILE / "recipe" / citation).is_file(), source["id"])

        proposed_statuses = {
            feature["provenance"]["status"]
            for group in ("points", "lines", "polygons", "surfaces")
            for feature in project["features"][group]
            if feature["phase_id"] != "phase-01-existing-control-erosion"
        }
        self.assertNotIn("reference-derived", proposed_statuses)

        model = self._model_with_ledgers(project, sources, decisions)
        semantic = build_semantic_manifest(model)
        self.assertEqual(
            project["custom_authoring"], semantic["customAuthoring"]
        )
        self.assertEqual(receipt, semantic["geometryOriginReceipt"])

    def test_custom_geometry_receipt_rejects_reference_copy_relabel_attack(self):
        """Copying source geometry and changing its status must not create authorship."""

        project, sources, decisions = compile_profile(
            PROFILE,
            {"id": "origin-attack", "name": "Origin Attack"},
            DEFAULT_DESIGN_BRIEF,
        )
        model = self._model_with_ledgers(project, sources, decisions)
        reference = next(
            feature
            for feature in model["features"]["lines"]
            if feature["phase_id"] == "phase-01-existing-control-erosion"
            and feature["provenance"]["status"] == "reference-derived"
        )
        proposed = next(
            feature
            for feature in model["features"]["lines"]
            if feature["phase_id"] != "phase-01-existing-control-erosion"
            and feature["provenance"]["status"] == "reviewed_assumption"
        )
        original_decisions = copy.deepcopy(proposed["provenance"]["decision_ids"])
        proposed["coordinates"] = copy.deepcopy(reference["coordinates"])
        proposed["provenance"] = {
            "status": "reviewed_assumption",
            "source_ids": copy.deepcopy(reference["provenance"]["source_ids"]),
            "decision_ids": original_decisions,
        }

        error_codes = {
            issue.code for issue in validate_model(model) if issue.severity == "error"
        }

        self.assertIn("authoring.geometry_origin_receipt_mismatch", error_codes)

    def test_custom_geometry_requires_receipt_and_rejects_claimed_input_origin(self):
        project, sources, decisions = compile_profile(
            PROFILE,
            {"id": "origin-contract", "name": "Origin Contract"},
            DEFAULT_DESIGN_BRIEF,
        )
        model = self._model_with_ledgers(project, sources, decisions)

        missing = copy.deepcopy(model)
        missing.pop("geometry_origin_receipt")
        missing_codes = {
            issue.code for issue in validate_model(missing) if issue.severity == "error"
        }
        self.assertIn("authoring.geometry_origin_receipt_missing", missing_codes)

        malformed = copy.deepcopy(model)
        malformed["geometry_origin_receipt"]["reference_context_phase_ids"] = [{}]
        malformed_codes = {
            issue.code
            for issue in validate_model(malformed)
            if issue.severity == "error"
        }
        self.assertIn("authoring.geometry_origin_receipt_invalid", malformed_codes)

        claimed_input = copy.deepcopy(model)
        proposed = next(
            feature
            for group in ("points", "lines", "polygons", "surfaces")
            for feature in claimed_input["features"][group]
            if feature["phase_id"] != "phase-01-existing-control-erosion"
        )
        proposed["provenance"]["geometry_origin"] = "input_plan"
        input_codes = {
            issue.code
            for issue in validate_model(claimed_input)
            if issue.severity == "error"
        }
        self.assertIn("authoring.proposed_geometry_input_origin", input_codes)

    def test_authored_bundle_digest_is_key_order_independent_and_tamper_evident(self):
        project, sources, decisions = compile_profile(
            PROFILE,
            {"id": "digest-demo", "name": "Digest Demo"},
            DEFAULT_DESIGN_BRIEF,
        )
        first = authored_bundle_sha256(project, sources, decisions)
        reordered_project = json.loads(json.dumps(project, sort_keys=True))
        self.assertEqual(first, authored_bundle_sha256(reordered_project, sources, decisions))
        project["custom_plan_authoring"] = {"status": "complete"}
        stored = authored_bundle_sha256(project, sources, decisions)
        project["custom_plan_authoring"]["authored_bundle_sha256"] = stored
        self.assertEqual(stored, authored_bundle_sha256(project, sources, decisions))
        changed = copy.deepcopy(project)
        changed["project"]["name"] = "Tampered"
        self.assertNotEqual(first, authored_bundle_sha256(changed, sources, decisions))


if __name__ == "__main__":
    unittest.main()
