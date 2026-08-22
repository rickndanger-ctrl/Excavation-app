import copy
from typing import Any

from .validation import DISCLAIMER


def build_semantic_manifest(model: dict[str, Any]) -> dict[str, Any]:
    artifact = model.get("artifact_contract", {})
    unavailable = [
        {
            "system": row["system"],
            "reason": row["reason"],
            "provenance_status": row["provenance_status"],
        }
        for row in model["contract_coverage"]
        if row["availability"] != "modeled"
    ]
    points = [
        {
            "id": feature["id"],
            "type": feature["feature_type"],
            "system": feature.get("system"),
            "layerId": feature["layer_id"],
            "phase": feature["phase_id"],
            "x": feature["coordinates"][0],
            "y": feature["coordinates"][1],
            "label": feature["label"],
            "searchable": feature.get("field_detail", {}).get("searchable", True),
            "clickable": True,
            "mapTarget": feature.get("field_detail", {}).get("map_target", feature["id"]),
            "fieldDetail": feature.get("field_detail", {}),
            "wallAssociationId": feature.get("wall_association_id"),
            "networkTerminalId": feature.get("network_terminal_id"),
            "provenance": feature["provenance"],
        }
        for feature in model["features"]["points"]
    ]
    areas = [
        {
            "id": feature["id"],
            "type": feature["feature_type"],
            "system": feature.get("system"),
            "layerId": feature["layer_id"],
            "phase": feature["phase_id"],
            "label": feature["label"],
            "coordinates": feature["coordinates"],
            "searchable": feature.get("field_detail", {}).get("searchable", True),
            "clickable": True,
            "mapTarget": feature.get("field_detail", {}).get("map_target", feature["id"]),
            "fieldDetail": feature.get("field_detail", {}),
            "provenance": feature["provenance"],
        }
        for feature in model["features"]["polygons"]
    ]
    linear_features = [
        {
            "id": feature["id"],
            "type": feature["feature_type"],
            "system": feature.get("system"),
            "layerId": feature["layer_id"],
            "phase": feature["phase_id"],
            "label": feature["label"],
            "coordinates": feature["coordinates"],
            "searchable": feature.get("field_detail", {}).get("searchable", True),
            "clickable": True,
            "mapTarget": feature.get("field_detail", {}).get("map_target", feature["id"]),
            "fieldDetail": feature.get("field_detail", {}),
            "provenance": feature["provenance"],
        }
        for feature in model["features"]["lines"]
    ]
    surfaces = [
        {
            "id": feature["id"],
            "type": feature["feature_type"],
            "system": feature.get("system"),
            "layerId": feature["layer_id"],
            "phase": feature["phase_id"],
            "label": feature["label"],
            "coordinates": feature["boundary"],
            "verticalDatum": feature.get("vertical_datum"),
            "searchable": feature.get("field_detail", {}).get("searchable", True),
            "clickable": True,
            "mapTarget": feature.get("field_detail", {}).get("map_target", feature["id"]),
            "fieldDetail": feature.get("field_detail", {}),
            "provenance": feature["provenance"],
        }
        for feature in model["features"]["surfaces"]
    ]
    feature_by_id = {
        feature["id"]: feature
        for group in ("points", "lines", "polygons")
        for feature in model["features"][group]
    }
    utilities = []
    for network in model.get("networks", []):
        for edge in network.get("edges", []):
            geometry = feature_by_id[edge["geometry_feature_id"]]
            utilities.append({
                "id": edge["id"],
                "system": network["system"],
                "type": edge["edge_type"],
                "geometryFeatureId": edge["geometry_feature_id"],
                "coordinates": geometry["coordinates"],
                "fromNodeId": edge["from_node_id"],
                "toNodeId": edge["to_node_id"],
                "terminalFeatureId": edge.get("terminal_feature_id"),
                "label": geometry["label"],
                "searchable": True,
                "clickable": True,
                "mapTarget": edge["id"],
                "fieldDetail": edge.get("field_detail", {}),
                "provenance": edge["provenance"],
            })
    manifest = {
        "schema_version": "excavation-field-map.jobsite-package/v0.1.0",
        "canonical_model_version": model["schema_version"],
        "id": model["project"]["id"],
        "projectName": model["project"]["name"],
        "disclaimer": DISCLAIMER,
        "plan": {
            "availability": artifact.get("plan_availability", "generated_vector_pdf"),
            "imageUrl": artifact.get(
                "image_url", f"{artifact.get('basename', 'hilyard-site-layout')}.pdf"
            ),
            "widthFt": artifact.get("plan_width_ft", 178.59),
            "heightFt": artifact.get("plan_height_ft", 291.97),
            "coordinateBasis": artifact.get(
                "coordinate_basis",
                "EPSG:6823 reference-derived site geometry; not surveyed",
            ),
        },
        "phases": model["phases"],
        "layers": model["layers"],
        "objects": points,
        "areas": areas,
        "linearFeatures": linear_features,
        "surfaces": surfaces,
        "utilities": utilities,
        "userLocation": None,
        "userHeading": None,
        "calibrationPoints": [],
        "unavailable": unavailable,
        "provenance": {
            "source_ids": [source["id"] for source in model["sources"]],
            "decision_ids": [decision["id"] for decision in model["decisions"]],
        },
    }
    return copy.deepcopy(manifest)
