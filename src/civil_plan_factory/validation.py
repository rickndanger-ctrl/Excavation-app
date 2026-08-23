from dataclasses import asdict, dataclass
import hashlib
import json
import math
from pathlib import Path
import re
from typing import Any, Iterable


DISCLAIMER = "FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION"
SAFETY_NOTICE = "FICTIONAL TEST DATA — NOT FOR CONSTRUCTION — NOT ENGINEERED OR PERMITTED"
SEMANTIC_ONLY_DELIVERY_MODE = "semantic_only_ungeoreferenced"
CUSTOM_AUTHORING_MODE = "custom_semantic_design"
CUSTOM_SEMANTIC_AUTHORING_CONTRACT = {
    "mode": CUSTOM_AUTHORING_MODE,
    "canonical_authority": "semantic_model",
    "deliverable_origin": "generated_from_canonical_model",
    "reference_material_policy": "context_and_conventions_only",
}
CUSTOM_GEOMETRY_ORIGIN_RECEIPT_SCHEMA = (
    "civil-plan-factory.geometry-origin-receipt/v0.1.0"
)
CUSTOM_GEOMETRY_ORIGIN = "registered_semantic_recipe"
CUSTOM_AUTHORING_MARKERS = frozenset({
    "authoring_contract",
    "custom_authoring",
    "custom_plan_authoring",
    "custom_plan_profile",
    "geometry_origin_receipt",
})
FORBIDDEN_PROPOSED_GEOMETRY_ORIGINS = {
    "input_plan",
    "reference_plan",
    "reference_source",
    "source_plan",
}
SEMANTIC_REVIEW_GRID_BASIS = (
    "UNREFERENCED_REVIEW_GRID — uncalibrated source-sheet display coordinates; "
    "not field feet or staking control."
)
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
REQUIRED_INTERFACE_SYSTEMS = {
    "sanitary", "domestic_water", "fire_water", "roof_drainage",
    "electric", "telecom_fiber", "gas", "site_lighting",
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


def _point_on_ring(point: list[float], ring: list[list[float]], tolerance: float = 0.01) -> bool:
    px, py = point[:2]
    for a, b in zip(ring, ring[1:]):
        ax, ay = a[:2]
        bx, by = b[:2]
        cross = (px - ax) * (by - ay) - (py - ay) * (bx - ax)
        segment_length = math.hypot(bx - ax, by - ay)
        if segment_length and abs(cross) / segment_length > tolerance:
            continue
        dot = (px - ax) * (px - bx) + (py - ay) * (py - by)
        if dot <= tolerance:
            return True
    return False


def _point_in_polygon(point: list[float], ring: list[list[float]]) -> bool:
    x, y = point[:2]
    inside = False
    for a, b in zip(ring, ring[1:]):
        x1, y1 = a[:2]
        x2, y2 = b[:2]
        if (y1 > y) != (y2 > y):
            crossing_x = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < crossing_x:
                inside = not inside
    return inside


def _orientation(a: list[float], b: list[float], c: list[float]) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _segments_cross(a: list[float], b: list[float], c: list[float], d: list[float]) -> bool:
    return _orientation(a, b, c) * _orientation(a, b, d) < 0 and _orientation(c, d, a) * _orientation(c, d, b) < 0


def _polygons_overlap(first: list[list[float]], second: list[list[float]]) -> bool:
    if any(_point_in_polygon(point, second) for point in first[:-1]):
        return True
    if any(_point_in_polygon(point, first) for point in second[:-1]):
        return True
    return any(
        _segments_cross(a, b, c, d)
        for a, b in zip(first, first[1:])
        for c, d in zip(second, second[1:])
    )


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


def custom_geometry_membership(
    model: dict[str, Any], reference_context_phase_ids: list[str]
) -> dict[str, Any]:
    """Digest the identity, geometry, and provenance of custom-authored features.

    Reference/context phases are deliberately outside this receipt. Their GIS or
    source geometry remains usable as visibly non-authoritative context, while
    every other feature is locked to the registered semantic recipe.
    """

    if (
        not isinstance(reference_context_phase_ids, list)
        or not reference_context_phase_ids
        or any(
            not isinstance(phase_id, str) or not phase_id
            for phase_id in reference_context_phase_ids
        )
        or len(set(reference_context_phase_ids)) != len(reference_context_phase_ids)
    ):
        raise ValueError("Reference-context phase IDs must be a unique non-empty list")
    reference_phases = set(reference_context_phase_ids)
    members: list[dict[str, Any]] = []
    for group in ("points", "lines", "polygons", "surfaces"):
        geometry_key = "boundary" if group == "surfaces" else "coordinates"
        for feature in model.get("features", {}).get(group, []):
            if feature.get("phase_id") in reference_phases:
                continue
            members.append({
                "collection": group,
                "id": feature.get("id"),
                "feature_type": feature.get("feature_type"),
                "system": feature.get("system"),
                "layer_id": feature.get("layer_id"),
                "phase_id": feature.get("phase_id"),
                "geometry": feature.get(geometry_key),
                "provenance": feature.get("provenance"),
            })
    members.sort(key=lambda row: (str(row["collection"]), str(row["id"])))
    encoded = json.dumps(
        members,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")
    return {
        "authored_feature_count": len(members),
        "authored_geometry_membership_sha256": hashlib.sha256(encoded).hexdigest(),
    }


def has_custom_authoring_claim(model: dict[str, Any]) -> bool:
    """Keep every custom authorship claim in the fail-closed custom lane.

    The explicit mode is only one part of the authority record.  Deleting it
    must not let a profile, receipt, contract, or authored marker fall through
    to the more permissive reviewed-source workflow.
    """

    project = model.get("project")
    return (
        isinstance(project, dict)
        and project.get("authoring_mode") == CUSTOM_AUTHORING_MODE
    ) or any(marker in model for marker in CUSTOM_AUTHORING_MARKERS)


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

    if has_custom_authoring_claim(model):
        if project.get("authoring_mode") != CUSTOM_AUTHORING_MODE:
            issues.append(_issue(
                "authoring.custom_mode_missing",
                "project.authoring_mode",
                "Custom authorship markers require the explicit custom semantic design mode",
            ))
        authoring_contract = model.get("authoring_contract")
        if authoring_contract is None:
            issues.append(_issue(
                "authoring.custom_contract_missing",
                "authoring_contract",
                "Original custom plans require an explicit semantic-authoring contract",
            ))
        elif (
            authoring_contract != CUSTOM_SEMANTIC_AUTHORING_CONTRACT
            or "reviewed_source_adapter" in model
        ):
            issues.append(_issue(
                "authoring.custom_contract_invalid",
                "authoring_contract",
                "Custom plans must originate in the semantic model; references may provide context and conventions only",
            ))

        receipt = model.get("geometry_origin_receipt")
        reference_context_phase_ids = ["phase-01-existing-control-erosion"]
        if not isinstance(receipt, dict):
            issues.append(_issue(
                "authoring.geometry_origin_receipt_missing",
                "geometry_origin_receipt",
                "Custom proposed geometry requires a registered semantic-recipe receipt",
            ))
        else:
            receipt_shape_valid = (
                receipt.get("schema_version") == CUSTOM_GEOMETRY_ORIGIN_RECEIPT_SCHEMA
                and receipt.get("origin") == CUSTOM_GEOMETRY_ORIGIN
                and isinstance(receipt.get("recipe_sha256"), str)
                and re.fullmatch(r"[0-9a-f]{64}", receipt.get("recipe_sha256", "")) is not None
                and isinstance(receipt.get("reference_context_phase_ids"), list)
                and isinstance(receipt.get("authored_feature_count"), int)
                and not isinstance(receipt.get("authored_feature_count"), bool)
                and isinstance(receipt.get("authored_geometry_membership_sha256"), str)
                and re.fullmatch(
                    r"[0-9a-f]{64}",
                    receipt.get("authored_geometry_membership_sha256", ""),
                ) is not None
            )
            if not receipt_shape_valid:
                issues.append(_issue(
                    "authoring.geometry_origin_receipt_invalid",
                    "geometry_origin_receipt",
                    "Custom geometry receipt is incomplete or uses an unsupported origin",
                ))
            else:
                candidate_reference_phase_ids = receipt[
                    "reference_context_phase_ids"
                ]
                try:
                    actual_membership = custom_geometry_membership(
                        model, candidate_reference_phase_ids
                    )
                except (TypeError, ValueError):
                    issues.append(_issue(
                        "authoring.geometry_origin_receipt_invalid",
                        "geometry_origin_receipt.reference_context_phase_ids",
                        "Custom geometry receipt has invalid reference-context membership",
                    ))
                else:
                    reference_context_phase_ids = candidate_reference_phase_ids
                    declared_membership = {
                        "authored_feature_count": receipt["authored_feature_count"],
                        "authored_geometry_membership_sha256": receipt[
                            "authored_geometry_membership_sha256"
                        ],
                    }
                    if declared_membership != actual_membership:
                        issues.append(_issue(
                            "authoring.geometry_origin_receipt_mismatch",
                            "geometry_origin_receipt.authored_geometry_membership_sha256",
                            "Custom proposed geometry differs from its registered semantic recipe",
                        ))
                custom_authoring = model.get("custom_authoring")
                if (
                    isinstance(custom_authoring, dict)
                    and custom_authoring.get("recipe_sha256")
                    != receipt.get("recipe_sha256")
                ):
                    issues.append(_issue(
                        "authoring.geometry_origin_receipt_mismatch",
                        "geometry_origin_receipt.recipe_sha256",
                        "Custom geometry receipt is not bound to the authored recipe digest",
                    ))

        reference_phases = set(reference_context_phase_ids)
        for group in ("points", "lines", "polygons", "surfaces"):
            for index, feature in enumerate(model.get("features", {}).get(group, [])):
                if (
                    feature.get("phase_id") not in reference_phases
                    and feature.get("provenance", {}).get("status") == "reference-derived"
                ):
                    issues.append(_issue(
                        "authoring.proposed_geometry_reference_derived",
                        f"features.{group}[{index}].provenance.status",
                        "Proposed custom-plan geometry cannot be derived from reference material",
                    ))
                claimed_origin = feature.get("provenance", {}).get("geometry_origin")
                if (
                    feature.get("phase_id") not in reference_phases
                    and claimed_origin in FORBIDDEN_PROPOSED_GEOMETRY_ORIGINS
                ):
                    issues.append(_issue(
                        "authoring.proposed_geometry_input_origin",
                        f"features.{group}[{index}].provenance.geometry_origin",
                        "Proposed custom-plan geometry cannot claim an input or reference plan as its origin",
                    ))

    artifact = model.get("artifact_contract", {})
    if artifact.get("delivery_mode") == SEMANTIC_ONLY_DELIVERY_MODE:
        expected_transform = {
            "from": "source_pdf_y_down_review_grid",
            "to": "canonical_y_up_review_grid",
            "status": "generated_display_transform",
            "formula": "x = source_x; y = plan_height - source_y",
        }
        tolerances = spatial.get("tolerances", {})
        tolerance = tolerances.get("output_parity_display_units")
        source_accuracy = tolerances.get("source_geometry_accuracy")
        benchmark = spatial.get("benchmark", {})
        conflicting_exports = [
            target.get("type")
            for target in model.get("export_targets", [])
            if target.get("status") == "available"
            and target.get("type") in {
                "geopackage", "vector_pdf", "dxf", "layered_vector_geopdf"
            }
        ]
        profile_checks = {
            "artifact_contract.plan_availability": artifact.get("plan_availability") in {
                "semantic_review_grid",
                "reviewed_finished_site_model",
            },
            "artifact_contract.image_url": artifact.get("image_url") == "",
            "artifact_contract.coordinate_basis": artifact.get("coordinate_basis") == SEMANTIC_REVIEW_GRID_BASIS,
            "artifact_contract.plan_width_ft": _finite_coordinate(artifact.get("plan_width_ft")) and artifact.get("plan_width_ft", 0) > 0,
            "artifact_contract.plan_height_ft": _finite_coordinate(artifact.get("plan_height_ft")) and artifact.get("plan_height_ft", 0) > 0,
            "spatial_reference.horizontal_crs": spatial.get("horizontal_crs") == "UNREFERENCED_REVIEW_GRID",
            "spatial_reference.horizontal_units": spatial.get("horizontal_units") == "display_unit",
            "spatial_reference.vertical_datum": spatial.get("vertical_datum") == "SOURCE_PLAN_DATUM_UNVERIFIED",
            "spatial_reference.vertical_units": spatial.get("vertical_units") == "foot",
            "spatial_reference.benchmark": benchmark.get("status") == "unknown" and bool(benchmark.get("reason")),
            "spatial_reference.transformations": spatial.get("transformations") == [expected_transform],
            "spatial_reference.tolerances.output_parity_display_units": _finite_coordinate(tolerance) and tolerance > 0,
            "spatial_reference.tolerances.no_field_unit_claim": "output_parity_horizontal_ft" not in tolerances,
            "spatial_reference.tolerances.source_geometry_accuracy": isinstance(source_accuracy, str) and "uncalibrated" in source_accuracy.lower() and "not field coordinates" in source_accuracy.lower(),
            "export_targets": not conflicting_exports,
        }
        invalid_fields = sorted(
            path for path, valid in profile_checks.items() if not valid
        )
        if invalid_fields:
            issues.append(_issue(
                "artifact.semantic_only_profile_invalid",
                "artifact_contract.delivery_mode",
                "Semantic-only delivery requires the exact unreferenced review-grid profile; conflicting fields: "
                + ", ".join(invalid_fields),
            ))

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
        for key in ("layer_id", "phase_id", "geometry_feature_id", "wall_association_id"):
            referenced_id = entity.get(key)
            if referenced_id is not None and referenced_id not in known_ids:
                issues.append(_issue("reference.unresolved", f"{path}.{key}", f"Unknown reference: {referenced_id}"))

    polygon_by_id = {feature.get("id"): feature for feature in features.get("polygons", [])}
    interfaces = [
        feature for feature in features.get("points", [])
        if feature.get("feature_type") == "wall_penetration"
    ]
    interface_systems = {feature.get("system") for feature in interfaces}
    coverage_by_system = {
        row.get("system"): row for row in model.get("contract_coverage", [])
    }
    contract_system_for_interface = {"electric": "power"}
    modeled_network_systems = {
        network.get("system") for network in model.get("networks", [])
    }
    required_interfaces = {
        system for system in REQUIRED_INTERFACE_SYSTEMS
        if (
            coverage_by_system.get(
                contract_system_for_interface.get(system, system), {}
            ).get("availability") == "modeled"
            or contract_system_for_interface.get(system, system) in modeled_network_systems
        )
    }
    for system in sorted(required_interfaces - interface_systems):
        issues.append(_issue("interface.missing_system", "features.points", f"Missing permanent building terminal for: {system}"))
    for index, interface in enumerate(interfaces):
        building = polygon_by_id.get(interface.get("wall_association_id"))
        if building and not _point_on_ring(interface.get("coordinates", []), building.get("coordinates", [])):
            issues.append(_issue("interface.off_wall", f"features.points[{index}].coordinates", "Wall penetration is not on its associated building perimeter"))
        if interface.get("network_terminal_id") != interface.get("id"):
            issues.append(_issue("interface.terminal_id_invalid", f"features.points[{index}].network_terminal_id", "Permanent terminal reference must equal the stable feature ID"))

    design_polygons = [
        feature for feature in features.get("polygons", [])
        if feature.get("feature_type") in {"building", "building_pad"}
    ]
    constraint_polygons = [
        feature for feature in features.get("polygons", [])
        if str(feature.get("id", "")).startswith("constraint-")
    ]
    for design in design_polygons:
        for constraint in constraint_polygons:
            if _polygons_overlap(design["coordinates"], constraint["coordinates"]):
                issues.append(_issue(
                    "design.constraint_overlap",
                    f"features.polygons.{design['id']}",
                    f"{design['id']} overlaps {constraint['id']}",
                ))

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

    sanitary = next((row for row in model.get("networks", []) if row.get("system") == "sanitary"), None)
    if sanitary and sanitary.get("edges"):
        sanitary_edges = {row["id"]: row for row in sanitary["edges"]}
        for edge_index, edge in enumerate(sanitary["edges"]):
            detail = edge.get("field_detail", {})
            path = f"networks.{sanitary['id']}.edges[{edge_index}].field_detail"
            upstream = detail.get("upstream_invert_ft")
            downstream = detail.get("downstream_invert_ft")
            if not (_finite_coordinate(upstream) and _finite_coordinate(downstream)) or upstream <= downstream:
                issues.append(_issue("sanitary.flow_not_downhill", path, "Gravity edge invert must fall in its downstream direction"))
            slope = detail.get("slope_percent")
            minimum_slope = detail.get("minimum_slope_percent")
            if _finite_coordinate(slope) and _finite_coordinate(minimum_slope) and slope + 1e-9 < minimum_slope:
                issues.append(_issue("sanitary.slope_below_min", path, "Gravity edge slope is below its cited minimum"))
            if detail.get("validation_scope") != "reference_context":
                samples = detail.get("cover_samples_ft", [])
                minimum_cover = detail.get("minimum_cover_ft")
                if not samples or not _finite_coordinate(minimum_cover) or min(samples) + 1e-9 < minimum_cover:
                    issues.append(_issue("sanitary.cover_below_min", path, "Proposed gravity edge violates its minimum cover envelope"))
        for node_index, node in enumerate(sanitary.get("nodes", [])):
            detail = node.get("field_detail", {})
            if detail.get("structure_drop_rule_applies"):
                drop = detail.get("connection_drop_ft")
                minimum = detail.get("minimum_drop_ft", 0.1)
                if not _finite_coordinate(drop) or drop + 1e-9 < minimum:
                    issues.append(_issue(
                        "sanitary.structure_drop_invalid",
                        f"networks.{sanitary['id']}.nodes[{node_index}].field_detail.connection_drop_ft",
                        "Structure connection drop is below the cited normal minimum",
                    ))
                if detail.get("owner_approval_status") != "unknown" or detail.get("capacity_status") != "unknown":
                    issues.append(_issue(
                        "sanitary.unresolved_assumption_missing",
                        f"networks.{sanitary['id']}.nodes[{node_index}].field_detail",
                        "Assumed tie-in must preserve unknown approval and capacity status",
                    ))
        for profile_index, profile in enumerate(model.get("deliverables", {}).get("profiles", [])):
            if profile.get("id") != "profile-sanitary-service":
                continue
            for segment_index, segment in enumerate(profile.get("segments", [])):
                edge = sanitary_edges.get(segment.get("edge_id"))
                if edge is None:
                    issues.append(_issue("profile.model_mismatch", f"deliverables.profiles[{profile_index}].segments[{segment_index}]", "Profile edge is unresolved"))
                    continue
                detail = edge.get("field_detail", {})
                for key in ("length_ft", "upstream_invert_ft", "downstream_invert_ft"):
                    if not math.isclose(float(segment.get(key, float("nan"))), float(detail.get(key, float("inf"))), abs_tol=1e-6):
                        issues.append(_issue("profile.model_mismatch", f"deliverables.profiles[{profile_index}].segments[{segment_index}].{key}", "Profile ordinate differs from its canonical network edge"))

    storm = next((row for row in model.get("networks", []) if row.get("system") == "storm"), None)
    if storm and storm.get("edges"):
        storm_edges = {row["id"]: row for row in storm["edges"]}
        for edge_index, edge in enumerate(storm["edges"]):
            detail = edge.get("field_detail", {})
            path = f"networks.{storm['id']}.edges[{edge_index}].field_detail"
            upstream = detail.get("upstream_invert_ft")
            downstream = detail.get("downstream_invert_ft")
            if not (_finite_coordinate(upstream) and _finite_coordinate(downstream)) or upstream <= downstream:
                issues.append(_issue("storm.flow_not_downhill", path, "Gravity edge invert must fall in its downstream direction"))
            slope = detail.get("slope_percent")
            minimum_slope = detail.get("minimum_slope_percent")
            if _finite_coordinate(slope) and _finite_coordinate(minimum_slope) and slope + 1e-9 < minimum_slope:
                issues.append(_issue("storm.slope_below_min", path, "Gravity edge slope is below its declared minimum"))
            if detail.get("validation_scope") != "reference_context":
                samples = detail.get("cover_samples_ft", [])
                minimum_cover = detail.get("minimum_cover_ft")
                if not samples or not _finite_coordinate(minimum_cover) or min(samples) + 1e-9 < minimum_cover:
                    issues.append(_issue("storm.cover_below_min", path, "Proposed gravity edge violates its minimum cover envelope"))
        for node_index, node in enumerate(storm.get("nodes", [])):
            detail = node.get("field_detail", {})
            if detail.get("structure_drop_rule_applies"):
                drop = detail.get("connection_drop_ft")
                minimum = detail.get("minimum_drop_ft", 0.1)
                maximum = detail.get("maximum_internal_drop_ft")
                if not _finite_coordinate(drop) or drop + 1e-9 < minimum or (
                    _finite_coordinate(maximum) and drop > maximum + 1e-9
                ):
                    issues.append(_issue(
                        "storm.structure_drop_invalid",
                        f"networks.{storm['id']}.nodes[{node_index}].field_detail.connection_drop_ft",
                        "Structure connection drop is outside its declared internal-drop envelope",
                    ))
                if detail.get("owner_approval_status") != "unknown" or detail.get("capacity_status") != "unknown":
                    issues.append(_issue(
                        "storm.unresolved_assumption_missing",
                        f"networks.{storm['id']}.nodes[{node_index}].field_detail",
                        "Assumed storm structure must preserve unknown approval and capacity status",
                    ))
        for profile_index, profile in enumerate(model.get("deliverables", {}).get("profiles", [])):
            if profile.get("id") != "profile-storm-roof-to-public":
                continue
            for segment_index, segment in enumerate(profile.get("segments", [])):
                edge = storm_edges.get(segment.get("edge_id"))
                if edge is None:
                    issues.append(_issue("profile.model_mismatch", f"deliverables.profiles[{profile_index}].segments[{segment_index}]", "Profile edge is unresolved"))
                    continue
                detail = edge.get("field_detail", {})
                for key in ("length_ft", "upstream_invert_ft", "downstream_invert_ft"):
                    if not math.isclose(float(segment.get(key, float("nan"))), float(detail.get(key, float("inf"))), abs_tol=1e-6):
                        issues.append(_issue("profile.model_mismatch", f"deliverables.profiles[{profile_index}].segments[{segment_index}].{key}", "Profile ordinate differs from its canonical network edge"))

    roof = next((row for row in model.get("networks", []) if row.get("system") == "roof_drainage"), None)
    if roof is not None:
        terminal = next((row for row in roof.get("nodes", []) if row.get("geometry_feature_id") == "penetration-roof-drainage"), None)
        connected = terminal is not None and any(
            edge.get("to_node_id") == terminal.get("id") for edge in roof.get("edges", [])
        )
        if not connected:
            issues.append(_issue("roof_drainage.terminal_disconnected", "networks.network-roof-drainage", "Roof leaders must resolve to the permanent building terminal"))

    if "water_fire_basis" in model:
        pressure_terminals = {
            "domestic_water": "penetration-domestic-water",
            "fire_water": "penetration-fire-water",
        }
        for system, terminal_feature_id in pressure_terminals.items():
            network = next((row for row in model.get("networks", []) if row.get("system") == system), None)
            if network is None:
                continue
            terminal_node = next(
                (row for row in network.get("nodes", []) if row.get("geometry_feature_id") == terminal_feature_id),
                None,
            )
            connected = terminal_node is not None and any(
                terminal_node.get("id") in {edge.get("from_node_id"), edge.get("to_node_id")}
                for edge in network.get("edges", [])
            )
            if not connected:
                issues.append(_issue(
                    "pressure.terminal_disconnected",
                    f"networks.{network['id']}",
                    f"{system} must resolve to its permanent building terminal",
                ))
            for edge_index, edge in enumerate(network.get("edges", [])):
                detail = edge.get("field_detail", {})
                path = f"networks.{network['id']}.edges[{edge_index}].field_detail"
                diameter = detail.get("diameter_in", detail.get("conduit_or_pipe_size_in"))
                material = detail.get("material")
                if not _finite_coordinate(diameter) or diameter <= 0 or not isinstance(material, str) or not material.strip():
                    issues.append(_issue(
                        "pressure.material_or_diameter_missing",
                        path,
                        "Pressure edges require a positive diameter and declared material",
                    ))
                samples = detail.get("cover_samples_ft", [])
                minimum_cover = detail.get("minimum_cover_ft")
                if not samples or not _finite_coordinate(minimum_cover) or min(samples) + 1e-9 < minimum_cover:
                    issues.append(_issue(
                        "pressure.cover_below_min",
                        path,
                        "Pressure edge violates its declared minimum cover",
                    ))
                if detail.get("capacity_status") != "unknown" or detail.get("available_pressure_status") != "unknown":
                    issues.append(_issue(
                        "pressure.unsupported_hydraulic_claim",
                        path,
                        "Capacity and available pressure must remain unknown without accepted hydraulic evidence",
                    ))

    if "dry_utility_basis" in model:
        dry_terminals = {
            "power": "penetration-electric",
            "telecom_fiber": "penetration-telecom-fiber",
            "gas": "penetration-gas",
            "site_lighting": "penetration-site-lighting",
        }
        for system, terminal_feature_id in dry_terminals.items():
            network = next((row for row in model.get("networks", []) if row.get("system") == system), None)
            if network is None:
                issues.append(_issue("dry.network_missing", "networks", f"Missing dry-utility network: {system}"))
                continue
            terminal_node = next(
                (row for row in network.get("nodes", []) if row.get("geometry_feature_id") == terminal_feature_id),
                None,
            )
            connected = terminal_node is not None and any(
                terminal_node.get("id") in {edge.get("from_node_id"), edge.get("to_node_id")}
                for edge in network.get("edges", [])
            )
            if not connected:
                issues.append(_issue(
                    "dry.terminal_disconnected",
                    f"networks.{network['id']}",
                    f"{system} must resolve to its permanent building terminal",
                ))
            for edge_index, edge in enumerate(network.get("edges", [])):
                detail = edge.get("field_detail", {})
                path = f"networks.{network['id']}.edges[{edge_index}].field_detail"
                length = detail.get("length_ft")
                count = detail.get("conduit_or_pipe_count")
                material = detail.get("material")
                if not _finite_coordinate(length) or length <= 0 or not _finite_coordinate(count) or count <= 0 or not isinstance(material, str) or not material.strip():
                    issues.append(_issue(
                        "dry.installation_data_missing",
                        path,
                        "Dry-utility edges require positive length/count and a declared material basis",
                    ))
                if detail.get("capacity_status") != "unknown" or detail.get("owner_approval_status") != "unknown":
                    issues.append(_issue(
                        "dry.unsupported_capacity_claim",
                        path,
                        "Capacity and owner approval must remain unknown without accepted owner design",
                    ))
        dry_systems = set(dry_terminals) | {"dry_utilities"}
        for group in ("lines", "polygons"):
            for feature_index, feature in enumerate(model.get("features", {}).get(group, [])):
                if feature.get("system") not in dry_systems or feature.get("phase_id") != "proposed":
                    continue
                style = feature.get("field_detail", {}).get("display_style", {})
                if feature.get("provenance", {}).get("status") != "reviewed_assumption" or style.get("status_badge") != "ASSUMED" or style.get("line_style") != "dashed" or "ASSUMED ROUTE" not in feature.get("label", ""):
                    issues.append(_issue(
                        "dry.assumed_route_style_missing",
                        f"features.{group}[{feature_index}]",
                        "Assumed dry-utility geometry must remain unmistakably labeled and dashed",
                    ))

    if "grading_basis" in model:
        grading_basis = model.get("grading_basis", {})
        conversion = grading_basis.get("vertical_conversion", {})
        shift = conversion.get("applied_shift_ft")
        if (
            conversion.get("source_datum") != "NGVD29"
            or conversion.get("target_datum") != "NAVD88"
            or not _finite_coordinate(shift)
            or conversion.get("method") != "NOAA VDatum / VERTCON 3.0"
        ):
            issues.append(_issue(
                "grading.vertical_conversion_missing",
                "grading_basis.vertical_conversion",
                "Historical contours require an explicit NOAA NGVD29-to-NAVD88 conversion",
            ))
        for surface_index, surface in enumerate(features.get("surfaces", [])):
            if surface.get("id") not in {"surface-existing-grade-reference", "surface-proposed-grade"}:
                continue
            detail = surface.get("field_detail", {})
            if detail.get("survey_authority") is not False:
                issues.append(_issue(
                    "grading.unsupported_survey_claim",
                    f"features.surfaces[{surface_index}].field_detail.survey_authority",
                    "Reference and fictional grading surfaces cannot claim survey authority",
                ))
            if surface.get("id") == "surface-proposed-grade" and not detail.get("elevation_samples"):
                issues.append(_issue(
                    "grading.surface_samples_missing",
                    f"features.surfaces[{surface_index}].field_detail.elevation_samples",
                    "Proposed grade requires canonical elevation samples",
                ))
        for line_index, line in enumerate(features.get("lines", [])):
            if line.get("feature_type") != "existing_contour_reference":
                continue
            detail = line.get("field_detail", {})
            source_elevation = detail.get("source_elevation_ft")
            model_elevation = detail.get("elevation_ft")
            if (
                detail.get("source_vertical_datum") != "NGVD29"
                or detail.get("model_vertical_datum") != "NAVD88"
                or not all(_finite_coordinate(value) for value in (source_elevation, model_elevation, shift))
                or not math.isclose(source_elevation + shift, model_elevation, abs_tol=1e-6)
                or "NGVD29" not in line.get("label", "")
                or "NAVD88" not in line.get("label", "")
            ):
                issues.append(_issue(
                    "grading.contour_datum_mismatch",
                    f"features.lines[{line_index}].field_detail",
                    "Existing contours must preserve both source NGVD29 and converted NAVD88 elevations",
                ))
        for polygon_index, polygon in enumerate(features.get("polygons", [])):
            if polygon.get("feature_type") == "earthwork_classification_zone":
                detail = polygon.get("field_detail", {})
                if (
                    model.get("earthwork_summary", {}).get("quantity_status") == "withheld_pending_survey_surface"
                    and (
                        "average_depth_ft" in detail
                        or "volume_cy" in detail
                        or detail.get("classification_status") != "unknown_pending_complete_existing_tin"
                    )
                ):
                    issues.append(_issue(
                        "grading.earthwork_quantity_must_be_withheld",
                        f"features.polygons[{polygon_index}].field_detail",
                        "Cut/fill classification and quantities must remain withheld until a complete existing TIN exists",
                    ))
                continue
            if polygon.get("feature_type") not in {"earthwork_fill_area", "earthwork_cut_area"}:
                continue
            detail = polygon.get("field_detail", {})
            area = detail.get("area_sf")
            depth = detail.get("average_depth_ft")
            volume = detail.get("volume_cy")
            if (
                not all(_finite_coordinate(value) for value in (area, depth, volume))
                or not math.isclose(area * depth / 27.0, volume, abs_tol=1e-6)
            ):
                issues.append(_issue(
                    "grading.earthwork_volume_mismatch",
                    f"features.polygons[{polygon_index}].field_detail.volume_cy",
                    "Screening earthwork volume must derive from area and average depth",
                ))

    if basis := model.get("vertical_design_basis"):
        by_id = {
            feature["id"]: feature
            for group in ("points", "lines", "polygons", "surfaces")
            for feature in features.get(group, [])
        }
        if (
            spatial.get("vertical_datum")
            and basis.get("vertical_datum") != spatial.get("vertical_datum")
        ):
            issues.append(_issue(
                "vertical.datum_mismatch",
                "vertical_design_basis.vertical_datum",
                "Whole-job vertical basis must use the project vertical datum",
            ))
        if (
            basis.get("status") != "reviewed_assumption"
            or basis.get("benchmark_status") != "unknown"
            or basis.get("survey_authority") is not False
        ):
            issues.append(_issue(
                "vertical.authority_invalid",
                "vertical_design_basis",
                "Fictional elevations require reviewed-assumption status, unknown benchmark, and no survey authority",
            ))

        ffe = basis.get("finished_floor_elevation_ft")
        for entry_id in (
            "entry-south-primary",
            "entry-east-service",
            "entry-north-pedestrian",
        ):
            entry = by_id.get(entry_id, {})
            if entry.get("field_detail", {}).get("threshold_elevation_ft") != ffe:
                issues.append(_issue(
                    "vertical.entry_ffe_mismatch",
                    f"features.{entry_id}.field_detail.threshold_elevation_ft",
                    "Entry threshold must match the canonical finished-floor elevation",
                ))

        for feature_id, feature in by_id.items():
            profile = feature.get("field_detail", {}).get("vertical_profile")
            if not profile:
                continue
            high = profile.get("high_elevation_ft")
            low = profile.get("low_elevation_ft")
            run = profile.get("run_ft")
            slope = profile.get("slope_percent")
            valid = all(_finite_coordinate(value) for value in (high, low, run, slope))
            if (
                not valid
                or run <= 0
                or high < low
                or not math.isclose((high - low) / run * 100.0, slope, abs_tol=1e-5)
            ):
                issues.append(_issue(
                    "vertical.profile_slope_mismatch",
                    f"features.{feature_id}.field_detail.vertical_profile",
                    "Vertical profile slope must derive from its high, low, and run controls",
                ))

        plane = basis.get("arrival_court_plane", {})
        origin_feature = by_id.get(plane.get("origin_feature_id"), {})
        origin_coordinates = origin_feature.get("coordinates", [])
        origin_index = plane.get("origin_vertex_index")
        if (
            not isinstance(origin_index, int)
            or origin_index < 0
            or origin_index >= len(origin_coordinates)
        ):
            issues.append(_issue(
                "vertical.arrival_plane_mismatch",
                "vertical_design_basis.arrival_court_plane",
                "Arrival-court plane requires a resolvable origin vertex",
            ))
        else:
            origin_x, origin_y = origin_coordinates[origin_index][:2]
            origin_elevation = plane.get("origin_elevation_ft")
            rise_x = plane.get("rise_per_foot_local_x")
            rise_y = plane.get("rise_per_foot_local_y")
            for feature_id in (
                "paving-arrival-court",
                "drive-aisle-arrival-01",
                "parking-stall-01",
                "parking-stall-02",
                "parking-stall-03",
                "parking-stall-04",
                "parking-stall-05",
            ):
                feature = by_id.get(feature_id, {})
                coordinates = feature.get("coordinates", [])
                controls = feature.get("field_detail", {}).get("grade_controls", [])
                for control in controls:
                    vertex_index = control.get("vertex_index")
                    if not isinstance(vertex_index, int) or vertex_index >= len(coordinates):
                        issues.append(_issue(
                            "vertical.arrival_plane_mismatch",
                            f"features.{feature_id}.field_detail.grade_controls",
                            "Arrival-court grade control must resolve to a feature vertex",
                        ))
                        continue
                    x, y = coordinates[vertex_index][:2]
                    expected = origin_elevation + (x - origin_x) * rise_x + (y - origin_y) * rise_y
                    if not math.isclose(control.get("elevation_ft", float("nan")), expected, abs_tol=1e-3):
                        issues.append(_issue(
                            "vertical.arrival_plane_mismatch",
                            f"features.{feature_id}.field_detail.grade_controls[{vertex_index}]",
                            "Arrival-court control elevation does not match the canonical plane",
                        ))

        utility_edge_ids = set(basis.get("pressure_and_dry_utility_edge_ids", []))
        utility_edges = {
            edge["id"]: (network.get("network_kind"), edge)
            for network in model.get("networks", [])
            for edge in network.get("edges", [])
            if edge.get("id") in utility_edge_ids
        }
        for edge_id in utility_edge_ids:
            network_kind, edge = utility_edges.get(edge_id, (None, {}))
            detail = edge.get("field_detail", {})
            surfaces = detail.get("surface_samples_ft", [])
            valid = (
                detail.get("vertical_datum") == basis.get("vertical_datum")
                and detail.get("vertical_status") == "reviewed_assumption"
                and detail.get("surface_id") == "surface-proposed-grade"
                and len(surfaces) == 2
                and all(_finite_coordinate(value) for value in surfaces)
            )
            if network_kind == "pressure":
                centerlines = detail.get("centerline_elevation_samples_ft", [])
                covers = detail.get("cover_samples_ft", [])
                diameter = detail.get(
                    "diameter_in", detail.get("conduit_or_pipe_size_in")
                )
                valid = (
                    valid
                    and detail.get("cover_reference") == "finished_surface_to_pipe_crown"
                    and _finite_coordinate(diameter)
                    and len(centerlines) == len(covers) == 2
                    and all(_finite_coordinate(value) for value in (*centerlines, *covers))
                    and all(
                        math.isclose(
                            surface - (centerline + diameter / 24.0),
                            cover,
                            abs_tol=1e-5,
                        )
                        for surface, centerline, cover in zip(surfaces, centerlines, covers)
                    )
                )
            elif network_kind == "dry":
                utility_tops = detail.get("utility_top_elevation_samples_ft", [])
                cover = detail.get("modeled_cover_ft")
                valid = (
                    valid
                    and detail.get("cover_reference") == "finished_surface_to_top_of_utility"
                    and _finite_coordinate(cover)
                    and len(utility_tops) == 2
                    and all(_finite_coordinate(value) for value in utility_tops)
                    and all(
                        math.isclose(surface - utility_top, cover, abs_tol=1e-5)
                        for surface, utility_top in zip(surfaces, utility_tops)
                    )
                )
            else:
                valid = False
            if not valid:
                issues.append(_issue(
                    "vertical.utility_cover_mismatch",
                    f"networks.edges.{edge_id}.field_detail",
                    "Utility absolute elevations must derive from the coordinated finished surface and declared cover reference",
                ))

    for relationship_id, relationship in model.get("relationships", {}).items():
        if relationship.get("relationship_type") not in {"utility_crossing", "horizontal_clearance"}:
            continue
        clearance = relationship.get("clearance_ft")
        minimum = relationship.get("minimum_clearance_ft")
        if not (_finite_coordinate(clearance) and _finite_coordinate(minimum)) or clearance + 1e-9 < minimum:
            issues.append(_issue(
                "utility.crossing_clearance_below_min",
                f"relationships.{relationship_id}.clearance_ft",
                "Utility crossing clearance is below its declared reviewed minimum",
            ))
    return sorted(issues)
