from dataclasses import asdict, dataclass
import hashlib
import math
from pathlib import Path
import re
from typing import Any, Iterable


DISCLAIMER = "FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION"
PROVENANCE_STATUSES = {
    "confirmed", "reference-derived", "reviewed_assumption", "generated", "unknown"
}
REQUIRED_SYSTEMS = {
    "coordinates_control", "property_limits", "easements_row_resource_limits",
    "surfaces", "sanitary", "storm", "domestic_water", "fire_water", "gas",
    "power", "telecom_fiber", "site_lighting", "roof_drainage", "structures",
    "buildings_pads", "grading", "curbs", "sidewalks", "paving", "ada",
    "demolition", "construction_erosion", "materials_specifications",
    "plans_profiles_sections_schedules", "field_details_workflows_checklists",
    "relationships",
}
ID_PATTERN = re.compile(r"^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$")


@dataclass(frozen=True, order=True)
class ValidationIssue:
    severity: str
    code: str
    path: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


def _issue(code: str, path: str, message: str) -> ValidationIssue:
    return ValidationIssue("error", code, path, message)


def _iter_entities(model: dict[str, Any]) -> Iterable[tuple[str, dict[str, Any]]]:
    for group in ("sources", "decisions", "phases", "layers"):
        for index, entity in enumerate(model.get(group, [])):
            yield f"{group}[{index}]", entity
    for group in ("points", "lines", "polygons", "surfaces"):
        for index, entity in enumerate(model.get("features", {}).get(group, [])):
            yield f"features.{group}[{index}]", entity
    for net_index, network in enumerate(model.get("networks", [])):
        yield f"networks[{net_index}]", network
        for group in ("nodes", "edges"):
            for index, entity in enumerate(network.get(group, [])):
                yield f"networks[{net_index}].{group}[{index}]", entity
    for group, entries in model.get("deliverables", {}).items():
        for index, entity in enumerate(entries):
            yield f"deliverables.{group}[{index}]", entity


def _finite_coordinate(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _valid_position(position: Any) -> bool:
    return isinstance(position, list) and len(position) in (2, 3) and all(
        _finite_coordinate(value) for value in position
    )


def _valid_line(coordinates: Any) -> bool:
    return (
        isinstance(coordinates, list)
        and len(coordinates) >= 2
        and all(_valid_position(point) for point in coordinates)
        and all(a != b for a, b in zip(coordinates, coordinates[1:]))
    )


def _valid_polygon(coordinates: Any) -> bool:
    if not _valid_line(coordinates) or len(coordinates) < 4 or coordinates[0] != coordinates[-1]:
        return False
    area_twice = sum(
        a[0] * b[1] - b[0] * a[1] for a, b in zip(coordinates, coordinates[1:])
    )
    return abs(area_twice) > 0


def _validate_provenance(path: str, entity: dict[str, Any]) -> list[ValidationIssue]:
    provenance = entity.get("provenance")
    if not isinstance(provenance, dict):
        return [_issue("provenance.missing", f"{path}.provenance", "Provenance is required")]
    issues: list[ValidationIssue] = []
    status = provenance.get("status")
    if status not in PROVENANCE_STATUSES:
        issues.append(_issue("provenance.status_invalid", f"{path}.provenance.status", "Unknown status"))
    source_ids = provenance.get("source_ids", [])
    decision_ids = provenance.get("decision_ids", [])
    if status in {"confirmed", "reference-derived"} and not source_ids:
        issues.append(_issue("provenance.source_required", f"{path}.provenance.source_ids", "Source-backed status requires a source"))
    if status == "reviewed_assumption" and not decision_ids:
        issues.append(_issue("provenance.decision_required", f"{path}.provenance.decision_ids", "Reviewed assumptions require a decision"))
    if status == "generated" and not (source_ids or decision_ids):
        issues.append(_issue("provenance.basis_required", f"{path}.provenance", "Generated data requires a derivation basis"))
    if status == "unknown" and not provenance.get("unavailable_reason"):
        issues.append(_issue("provenance.unavailable_reason_required", f"{path}.provenance", "Unknown data requires an unavailable reason"))
    return issues


def validate_model(model: dict[str, Any]) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    project = model.get("project", {})
    spatial = model.get("spatial_reference", {})
    if project.get("disclaimer") != DISCLAIMER:
        issues.append(_issue("disclaimer.missing", "project.disclaimer", f"Required exact disclaimer: {DISCLAIMER}"))
    if not spatial.get("horizontal_crs"):
        issues.append(_issue("crs.missing", "spatial_reference.horizontal_crs", "Horizontal CRS is required"))
    if not spatial.get("horizontal_units"):
        issues.append(_issue("units.missing", "spatial_reference.horizontal_units", "Horizontal units are required"))
    if not spatial.get("vertical_datum"):
        issues.append(_issue("datum.missing", "spatial_reference.vertical_datum", "Vertical datum is required"))

    for index, source in enumerate(model.get("sources", [])):
        lock = source.get("lock", {})
        if lock.get("kind") == "local_file" and lock.get("status") == "checksum_locked":
            path = source.get("citation")
            expected = lock.get("sha256")
            try:
                actual = hashlib.sha256(Path(path).read_bytes()).hexdigest()
            except (OSError, TypeError):
                issues.append(_issue("source.lock_unreadable", f"sources[{index}].citation", "Locked source file cannot be read"))
            else:
                if actual != expected:
                    issues.append(_issue("source.lock_mismatch", f"sources[{index}].lock.sha256", "Locked source checksum does not match"))

    seen: dict[str, str] = {}
    entities = list(_iter_entities(model))
    for path, entity in entities:
        entity_id = entity.get("id")
        if not isinstance(entity_id, str) or not ID_PATTERN.fullmatch(entity_id):
            issues.append(_issue("id.invalid", f"{path}.id", "ID must be a stable lowercase slug"))
        elif entity_id in seen:
            issues.append(_issue("id.duplicate", f"{path}.id", f"Duplicate ID also at {seen[entity_id]}"))
        else:
            seen[entity_id] = path

    features = model.get("features", {})
    for index, feature in enumerate(features.get("points", [])):
        if not _valid_position(feature.get("coordinates")):
            issues.append(_issue("geometry.point_invalid", f"features.points[{index}].coordinates", "Point must contain finite XY or XYZ"))
    for index, feature in enumerate(features.get("lines", [])):
        if not _valid_line(feature.get("coordinates")):
            issues.append(_issue("geometry.line_invalid", f"features.lines[{index}].coordinates", "Line requires two distinct finite positions"))
    for index, feature in enumerate(features.get("polygons", [])):
        if not _valid_polygon(feature.get("coordinates")):
            issues.append(_issue("geometry.polygon_invalid", f"features.polygons[{index}].coordinates", "Polygon must be closed and have nonzero area"))
    for index, surface in enumerate(features.get("surfaces", [])):
        if not _valid_polygon(surface.get("boundary")):
            issues.append(_issue("geometry.surface_invalid", f"features.surfaces[{index}].boundary", "Surface boundary must be a valid polygon"))

    provenance_paths = []
    for group in ("points", "lines", "polygons", "surfaces"):
        provenance_paths.extend(
            (f"features.{group}[{index}]", entity)
            for index, entity in enumerate(features.get(group, []))
        )
    for net_index, network in enumerate(model.get("networks", [])):
        node_ids = {node.get("id") for node in network.get("nodes", [])}
        for group in ("nodes", "edges"):
            provenance_paths.extend(
                (f"networks[{net_index}].{group}[{index}]", entity)
                for index, entity in enumerate(network.get(group, []))
            )
        for edge_index, edge in enumerate(network.get("edges", [])):
            for endpoint in ("from_node_id", "to_node_id"):
                if edge.get(endpoint) not in node_ids:
                    issues.append(_issue("network.endpoint_unresolved", f"networks[{net_index}].edges[{edge_index}].{endpoint}", "Network endpoint does not resolve within its network"))
    for path, entity in provenance_paths:
        issues.extend(_validate_provenance(path, entity))

    known_ids = set(seen)
    for path, entity in provenance_paths:
        provenance = entity.get("provenance", {})
        for key in ("source_ids", "decision_ids"):
            for referenced_id in provenance.get(key, []):
                if referenced_id not in known_ids:
                    issues.append(_issue("reference.unresolved", f"{path}.provenance.{key}", f"Unknown reference: {referenced_id}"))
        for key in ("layer_id", "phase_id", "geometry_feature_id"):
            referenced_id = entity.get(key)
            if referenced_id is not None and referenced_id not in known_ids:
                issues.append(_issue("reference.unresolved", f"{path}.{key}", f"Unknown reference: {referenced_id}"))

    coverage = {row.get("system") for row in model.get("contract_coverage", [])}
    for system in sorted(REQUIRED_SYSTEMS - coverage):
        issues.append(_issue("coverage.missing_system", "contract_coverage", f"Missing required system: {system}"))
    for system in sorted(coverage - REQUIRED_SYSTEMS):
        issues.append(_issue("coverage.unknown_system", "contract_coverage", f"Unknown system: {system}"))

    for key in ("plans", "profiles", "sections", "schedules", "detail_cards"):
        if key not in model.get("deliverables", {}):
            issues.append(_issue("contract.deliverable_type_missing", f"deliverables.{key}", "Deliverable collection is required"))
    for key in ("points", "lines", "polygons", "surfaces"):
        if key not in features:
            issues.append(_issue("contract.geometry_type_missing", f"features.{key}", "Canonical geometry collection is required"))
    return sorted(issues)
