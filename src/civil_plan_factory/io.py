import json
from pathlib import Path
from typing import Any


def load_project_bundle(project_path: Path) -> dict[str, Any]:
    project_path = Path(project_path).resolve()
    model = json.loads(project_path.read_text(encoding="utf-8"))
    for key, reference_key in (("sources", "source_ledger"), ("decisions", "decision_ledger")):
        reference = model.pop(reference_key, None)
        if reference:
            ledger_path = project_path.parent / reference
            ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
            model[key] = ledger[key]
    return model
