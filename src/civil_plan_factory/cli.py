import argparse
import json
from pathlib import Path

from .export import build_semantic_manifest
from .build import build_project
from .io import load_project_bundle
from .toolchain import smoke_check
from .validation import DISCLAIMER, validate_model


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="model-studio",
        description="Model Studio — deterministic civil test-model validation and generation",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate = subparsers.add_parser("validate", help="validate a project and emit skeleton artifacts")
    validate.add_argument("project", type=Path)
    validate.add_argument("--output-dir", required=True, type=Path)
    doctor = subparsers.add_parser("doctor", help="smoke-check the QGIS and GDAL runtime")
    doctor.add_argument(
        "--qgis-app",
        type=Path,
        default=Path("/Applications/QGIS-final-4_2_1.app"),
    )
    doctor.add_argument("--output", type=Path)
    build = subparsers.add_parser("build", help="validate and generate coordinated site-layout artifacts")
    build.add_argument("project", type=Path)
    build.add_argument("--output-dir", required=True, type=Path)
    build.add_argument(
        "--qgis-app",
        type=Path,
        default=Path("/Applications/QGIS-final-4_2_1.app"),
    )
    args = parser.parse_args(argv)

    if args.command == "doctor":
        report = smoke_check(args.qgis_app)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            _write_json(args.output, report)
        print(json.dumps(report, sort_keys=True))
        return 0

    if args.command == "build":
        return build_project(load_project_bundle(args.project), args.output_dir, args.qgis_app)

    model = load_project_bundle(args.project)
    issues = validate_model(model)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    report = {
        "schema_version": "civil-plan-factory.validation-report/v0.1.0",
        "project_id": model.get("project", {}).get("id"),
        "disclaimer": DISCLAIMER,
        "status": "invalid" if any(issue.severity == "error" for issue in issues) else "valid",
        "issues": [issue.to_dict() for issue in issues],
        "limitations": model.get("limitations", []),
    }
    _write_json(args.output_dir / "validation-report.json", report)
    if report["status"] == "valid":
        _write_json(args.output_dir / "semantic-manifest.json", build_semantic_manifest(model))
        return 0
    return 1
