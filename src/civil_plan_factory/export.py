from typing import Any

from .validation import DISCLAIMER


def build_semantic_manifest(model: dict[str, Any]) -> dict[str, Any]:
    unavailable = [
        {
            "system": row["system"],
            "reason": row["reason"],
            "provenance_status": row["provenance_status"],
        }
        for row in model["contract_coverage"]
        if row["availability"] != "modeled"
    ]
    return {
        "schema_version": "excavation-field-map.jobsite-package/v0.1.0",
        "canonical_model_version": model["schema_version"],
        "id": model["project"]["id"],
        "projectName": model["project"]["name"],
        "disclaimer": DISCLAIMER,
        "plan": {
            "availability": "unavailable",
            "imageUrl": None,
            "widthFt": None,
            "heightFt": None,
            "reason": "No plan sheet or surveyed site extent exists in the foundation slice.",
        },
        "phases": model["phases"],
        "layers": model["layers"],
        "objects": [],
        "utilities": [],
        "userLocation": None,
        "userHeading": None,
        "calibrationPoints": [],
        "unavailable": unavailable,
        "provenance": {
            "source_ids": [source["id"] for source in model["sources"]],
            "decision_ids": [decision["id"] for decision in model["decisions"]],
        },
    }
