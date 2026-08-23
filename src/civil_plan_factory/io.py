import json
import copy
import math
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
    if assignment := design.get("phase_assignment"):
        defaults = assignment.get("default_by_current_phase", {})
        by_layer = assignment.get("by_layer", {})
        by_system = assignment.get("by_system", {})
        by_feature_id = assignment.get("by_feature_id", {})
        protected = set(assignment.get("protected_current_phases", []))
        for group in ("points", "lines", "polygons", "surfaces"):
            for feature in model["features"][group]:
                current = feature["phase_id"]
                phase_id = defaults.get(current, current)
                if current not in protected:
                    phase_id = by_layer.get(feature.get("layer_id"), phase_id)
                    phase_id = by_system.get(feature.get("system"), phase_id)
                    phase_id = by_feature_id.get(feature["id"], phase_id)
                feature["phase_id"] = phase_id
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
    for update in design.get("network_updates", []):
        network = next(row for row in model["networks"] if row["id"] == update["id"])
        network_patch = {
            key: value
            for key, value in update.items()
            if key not in {"id", "node_updates", "edge_updates"}
        }
        _deep_update(network, network_patch)
        for group, update_key in (("nodes", "node_updates"), ("edges", "edge_updates")):
            rows_by_id = {row["id"]: row for row in network.get(group, [])}
            for row_update in update.get(update_key, []):
                _deep_update(rows_by_id[row_update["id"]], row_update)
    for group, rows in design.get("deliverables", {}).items():
        model["deliverables"][group].extend(copy.deepcopy(rows))
    if coverage := design.get("contract_coverage"):
        coverages = coverage if isinstance(coverage, list) else [coverage]
        for row_coverage in coverages:
            model["contract_coverage"] = [
                copy.deepcopy(row_coverage) if row["system"] == row_coverage["system"] else row
                for row in model["contract_coverage"]
            ]


def _map_coordinate_tree(value: Any, transform) -> Any:
    if (
        isinstance(value, list)
        and len(value) >= 2
        and all(isinstance(item, (int, float)) for item in value[:2])
    ):
        x, y = transform(float(value[0]), float(value[1]))
        return [round(x, 6), round(y, 6), *copy.deepcopy(value[2:])]
    if isinstance(value, list):
        return [_map_coordinate_tree(item, transform) for item in value]
    return copy.deepcopy(value)


def _apply_fixture_transform(model: dict[str, Any], fixture: dict[str, Any]) -> None:
    """Apply a topology-preserving site orientation used by test-library variants."""

    angle = math.radians(float(fixture.get("rotate_degrees", 0)))
    mirror_x = bool(fixture.get("mirror_x", False))
    translate_x, translate_y = fixture.get("translate_ft", [0, 0])
    site = next(
        row
        for row in model["features"]["polygons"]
        if row["id"] == "property-site-boundary"
    )["coordinates"]
    unique_site = site[:-1] if site and site[0] == site[-1] else site
    origin_x = sum(row[0] for row in unique_site) / len(unique_site)
    origin_y = sum(row[1] for row in unique_site) / len(unique_site)
    cosine, sine = math.cos(angle), math.sin(angle)

    def transform(x: float, y: float) -> tuple[float, float]:
        local_x, local_y = x - origin_x, y - origin_y
        if mirror_x:
            local_x = -local_x
        return (
            origin_x + local_x * cosine - local_y * sine + float(translate_x),
            origin_y + local_x * sine + local_y * cosine + float(translate_y),
        )

    for group in ("points", "lines", "polygons", "surfaces"):
        for feature in model["features"][group]:
            for key in ("coordinates", "boundary"):
                if key in feature:
                    feature[key] = _map_coordinate_tree(feature[key], transform)
    plane = model.get("vertical_design_basis", {}).get("arrival_court_plane")
    if plane:
        gradient_x = float(plane["rise_per_foot_local_x"])
        gradient_y = float(plane["rise_per_foot_local_y"])
        if mirror_x:
            gradient_x = -gradient_x
        plane["rise_per_foot_local_x"] = round(
            gradient_x * cosine - gradient_y * sine, 12
        )
        plane["rise_per_foot_local_y"] = round(
            gradient_x * sine + gradient_y * cosine, 12
        )


def _add_fixture_building_copies(model: dict[str, Any], count: int) -> None:
    if count <= 0:
        return
    source = next(
        row
        for row in model["features"]["polygons"]
        if row["id"] == "building-apartment-1"
    )
    orientation = math.radians(
        float(model["fixture_profile"].get("site_orientation_degrees", 0))
    )
    local_offsets = [(24.0, 0.0), (24.0, 24.0), (0.0, 24.0)]
    source_coordinates = source["coordinates"]
    source_ring = (
        source_coordinates[:-1]
        if source_coordinates and source_coordinates[0] == source_coordinates[-1]
        else source_coordinates
    )
    center_x = sum(row[0] for row in source_ring) / len(source_ring)
    center_y = sum(row[1] for row in source_ring) / len(source_ring)
    for index in range(count):
        duplicate = copy.deepcopy(source)
        duplicate["id"] = f"building-fixture-{index + 2}"
        duplicate["label"] = f"{model['fixture_profile']['program_label']} — Building {index + 2}"
        local_x, local_y = local_offsets[index % len(local_offsets)]
        dx = local_x * math.cos(orientation) - local_y * math.sin(orientation)
        dy = local_x * math.sin(orientation) + local_y * math.cos(orientation)
        duplicate["coordinates"] = _map_coordinate_tree(
            duplicate["coordinates"],
            lambda x, y: (
                center_x + (x - center_x) * 0.34 + dx,
                center_y + (y - center_y) * 0.34 + dy,
            ),
        )
        duplicate.setdefault("field_detail", {})["map_target"] = duplicate["id"]
        duplicate["field_detail"]["fixture_role"] = "additional_program_building"
        model["features"]["polygons"].append(duplicate)


def load_project_bundle(project_path: Path) -> dict[str, Any]:
    project_path = Path(project_path).resolve()
    raw = json.loads(project_path.read_text(encoding="utf-8"))
    base_reference = raw.pop("base_project", None)
    if base_reference:
        model = load_project_bundle(project_path.parent / base_reference)
        _deep_update(model, raw)
    else:
        model = raw
    for key, reference_key in (("sources", "source_ledger"), ("decisions", "decision_ledger")):
        reference = model.pop(reference_key, None)
        if reference:
            ledger_path = project_path.parent / reference
            ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
            model[key] = ledger[key]
    for reference in model.pop("design_slices", []):
        design_path = project_path.parent / reference
        _apply_design_slice(model, json.loads(design_path.read_text(encoding="utf-8")))
    fixture_transform = model.pop("fixture_transform", None)
    if fixture_transform:
        _apply_fixture_transform(model, fixture_transform)
    building_copies = int(model.pop("fixture_building_copies", 0))
    _add_fixture_building_copies(model, building_copies)
    return resolve_model_source_citations(model, project_path.parent)
