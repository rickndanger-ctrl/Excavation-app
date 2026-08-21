import json
import copy
from pathlib import Path
from typing import Any


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
    for group, rows in design.get("deliverables", {}).items():
        model["deliverables"][group].extend(copy.deepcopy(rows))
    if coverage := design.get("contract_coverage"):
        model["contract_coverage"] = [
            copy.deepcopy(coverage) if row["system"] == coverage["system"] else row
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
    return model
