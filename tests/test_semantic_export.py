import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from civil_plan_factory.export import build_semantic_manifest
from civil_plan_factory.io import load_project_bundle


ROOT = Path(__file__).parents[1]
PROJECT = ROOT / "projects" / "hilyard" / "project.json"
DISCLAIMER = "FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION"


class SemanticExportTests(unittest.TestCase):
    def test_cli_help_exposes_single_model_studio_entry_point(self):
        result = subprocess.run(
            [sys.executable, "-m", "civil_plan_factory", "--help"],
            cwd=ROOT,
            env={"PYTHONPATH": str(ROOT / "src")},
            text=True,
            capture_output=True,
        )
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("Model Studio", result.stdout)
        self.assertIn("usage: model-studio", result.stdout)

    def test_skeleton_preserves_app_contract_and_declares_unavailable_design(self):
        semantic = build_semantic_manifest(load_project_bundle(PROJECT))
        self.assertEqual(DISCLAIMER, semantic["disclaimer"])
        self.assertEqual("excavation-field-map.jobsite-package/v0.1.0", semantic["schema_version"])
        for key in ("phases", "layers", "objects", "utilities", "calibrationPoints"):
            self.assertIn(key, semantic)
        self.assertEqual([], semantic["objects"])
        self.assertGreater(len(semantic["unavailable"]), 0)
        self.assertNotIn("sheet_count", semantic)

    def test_cli_writes_deterministic_semantic_manifest_and_validation_report(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            commands = []
            for output in (first, second):
                commands.append([
                    sys.executable,
                    "-m",
                    "civil_plan_factory",
                    "validate",
                    str(PROJECT),
                    "--output-dir",
                    output,
                ])
            env = {"PYTHONPATH": str(ROOT / "src")}
            for command in commands:
                result = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True)
                self.assertEqual(0, result.returncode, result.stderr)
            names = ("semantic-manifest.json", "validation-report.json")
            for name in names:
                self.assertEqual(
                    (Path(first) / name).read_bytes(),
                    (Path(second) / name).read_bytes(),
                )
            report = json.loads((Path(first) / "validation-report.json").read_text())
            self.assertEqual("valid", report["status"])
            self.assertEqual(DISCLAIMER, report["disclaimer"])


if __name__ == "__main__":
    unittest.main()
