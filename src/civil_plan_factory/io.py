import json
import copy
from pathlib import Path
from typing import Any


PROJECT_BUNDLE_CITATION_SCOPE = "project_bundle"


def resolve_local_source_citation(
    project_directory: Path,
    citation: str,
    *,
    require_project_bundle: bool = False,
) -> Path:
    """Resolve a local source without letting bundle-scoped paths escape.

    Relative citations are always relative to the directory containing
    ``project.json``.  They, and any citation explicitly required to be
    bundle-local, are resolved through symlinks and must remain inside that
    directory.  Absolute paths remain supported only for legacy canonical
    projects whose source record is not bundle-scoped.
    """

    if not isinstance(citation, str) or not citation.strip():
        raise ValueError("Local source citation must be a non-empty path")
    project_root = Path(project_directory).resolve()
    raw_path = Path(citation)
    resolved = raw_path.resolve() if raw_path.is_absolute() else (project_root / raw_path).resolve()
    if require_project_bundle or not raw_path.is_absolute():
        try:
            resolved.relative_to(project_root)
        except ValueError as error:
            raise ValueError("Bundle-local source citation escapes the project directory") from error
    return resolved


def resolve_model_source_citations(
    model: dict[str, Any], project_directory: Path
) -> dict[str, Any]:
    """Return an in-memory model with local citations resolved for validation."""

    resolved_model = copy.deepcopy(model)
    for source in resolved_model.get("sources", []):
        lock = source.get("lock", {})
        if lock.get("kind") != "local_file":
            continue
        citation = source.get("citation")
        require_project_bundle = (
            source.get("citation_scope") == PROJECT_BUNDLE_CITATION_SCOPE
        )
        source["citation"] = str(resolve_local_source_citation(
            project_directory,
            citation,
            require_project_bundle=require_project_bundle,
        ))
    return resolved_model


def _deep_update(target: dict[str, Any], patch: dict[str, Any]) -> None:
    for key, value in patch.items():
        if key == "$replace":
            target.clear()
            target.update(copy.deepcopy(value))
            continue
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            _deep_update(target[key], value)
        else:
            target[key] = copy.deepcopy(value)


def _apply_design_slice(model: dict[str, Any], design: dict[str, Any]) -> None:
    model["project"]["revision"] = design["project_revision"]
    _deep_update(model, design.get("model_updates", {}))
    for group, updates in design.get("feature_updates", {}).items():
        by_id = {row["id"]: row for row in model["features"][group]}
        for update in updates:
            _deep_update(by_id[update["id"]], update)
    for group, rows in design.get("features", {}).items():
        model["features"][group].extend(copy.deepcopy(rows))
    if network := design.get("network"):
        model["networks"] = [
            copy.deepcopy(network) if row["id"] == network["id"] else row
            for row in model["networks"]
        ]
    for network in design.get("networks", []):
        model["networks"] = [
            copy.deepcopy(network) if row["id"] == network["id"] else row
            for row in model["networks"]
        ]
    for group, rows in design.get("deliverables", {}).items():
        model["deliverables"][group].extend(copy.deepcopy(rows))
    if coverage := design.get("contract_coverage"):
        coverages = coverage if isinstance(coverage, list) else [coverage]
        for row_coverage in coverages:
            model["contract_coverage"] = [
                copy.deepcopy(row_coverage) if row["system"] == row_coverage["system"] else row
                for row in model["contract_coverage"]
            ]


def load_project_bundle(project_path: Path) -> dict[str, Any]:
    project_path = Path(project_path).resolve()
    model = json.loads(project_path.read_text(encoding="utf-8"))
    for key, reference_key in (("sources", "source_ledger"), ("decisions", "decision_ledger")):
        reference = model.pop(reference_key, None)
        if reference:
            ledger_path = project_path.parent / reference
            ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
            model[key] = ledger[key]
    for reference in model.pop("design_slices", []):
        design_path = project_path.parent / reference
        _apply_design_slice(model, json.loads(design_path.read_text(encoding="utf-8")))
    return resolve_model_source_citations(model, project_path.parent)
