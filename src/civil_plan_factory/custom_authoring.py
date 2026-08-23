"""Deterministic compilation of registered original semantic plan recipes.

Found plans and reference files may document context and conventions, but this
module only promotes geometry already authored in a registered semantic recipe.
"""

from __future__ import annotations

import copy
import hashlib
import json
import math
from pathlib import Path
from typing import Any

from .io import load_project_bundle
from .validation import (
    CUSTOM_GEOMETRY_ORIGIN,
    CUSTOM_GEOMETRY_ORIGIN_RECEIPT_SCHEMA,
    CUSTOM_SEMANTIC_AUTHORING_CONTRACT,
    custom_geometry_membership,
    validate_model,
)


PROFILE_ID = "hilyard_golden_apartment_v1"

CUSTOM_AUTHORING_CONTRACT: dict[str, str] = copy.deepcopy(
    CUSTOM_SEMANTIC_AUTHORING_CONTRACT
)

DEFAULT_DESIGN_BRIEF: dict[str, Any] = {
    "goal": (
        "Show field employees the complete finished job first, then place every "
        "work layer over that shared visual reference."
    ),
    "site_program": {
        "archetype": "apartment_complex",
        "building_width_ft": 45.0,
        "building_length_ft": 90.0,
        "parking_stall_count": 5,
        "finished_site_scope": [
            "building",
            "entries",
            "parking",
            "drive_aisle",
            "curbs",
            "sidewalks",
            "landscape",
        ],
    },
    "vertical_design": {
        "vertical_datum": "NAVD88",
        "units": "feet",
        "finished_floor_elevation_ft": 445.0,
        "building_subgrade_elevation_ft": 443.5,
        "status": "reviewed_assumption_not_for_staking",
    },
    "presentation": {
        "base_view": "finished_site_first",
        "layer_relationship": "work_layers_over_finished_job",
        "plan_scale": "1 inch = 20 feet",
        "phone_recovery_control": "fit_full_plan",
    },
}

_PROFILE_SCHEMA = "civil-plan-factory.authoring-profile/v0.1.0"
_CUSTOM_AUTHORING_SCHEMA = "civil-plan-factory.custom-authoring/v0.1.0"


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def _same_registered_value(candidate: Any, registered: Any) -> bool:
    if isinstance(candidate, bool) or isinstance(registered, bool):
        return type(candidate) is type(registered) and candidate == registered
    if isinstance(candidate, (int, float)) and isinstance(registered, (int, float)):
        return (
            math.isfinite(float(candidate))
            and math.isfinite(float(registered))
            and float(candidate) == float(registered)
        )
    if isinstance(candidate, dict) and isinstance(registered, dict):
        return candidate.keys() == registered.keys() and all(
            _same_registered_value(candidate[key], registered[key])
            for key in candidate
        )
    if isinstance(candidate, list) and isinstance(registered, list):
        return len(candidate) == len(registered) and all(
            _same_registered_value(left, right)
            for left, right in zip(candidate, registered)
        )
    return type(candidate) is type(registered) and candidate == registered


def _read_profile(profile_dir: Path) -> dict[str, Any]:
    profile_dir = Path(profile_dir).resolve()
    metadata_path = profile_dir / "profile.json"
    try:
        profile = json.loads(metadata_path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValueError(f"Authoring profile is missing {metadata_path}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"Authoring profile is not valid JSON: {metadata_path}") from error
    if not isinstance(profile, dict) or profile.get("schema_version") != _PROFILE_SCHEMA:
        raise ValueError(f"Unsupported authoring profile schema in {metadata_path}")
    required = {
        "profile_id",
        "name",
        "version",
        "description",
        "recipe",
        "default_brief",
        "geometry_origin",
    }
    missing = sorted(required - profile.keys())
    if missing:
        raise ValueError(f"Authoring profile is missing required fields: {', '.join(missing)}")
    recipe = (profile_dir / profile["recipe"]).resolve()
    try:
        recipe.relative_to(profile_dir)
    except ValueError as error:
        raise ValueError(
            "Authoring profile recipe must stay inside its profile directory"
        ) from error
    if not recipe.is_file():
        raise ValueError(f"Authoring profile recipe does not exist: {recipe}")
    geometry_origin = profile["geometry_origin"]
    required_origin_fields = {
        "reference_context_phase_ids",
        "authored_feature_count",
        "authored_geometry_membership_sha256",
    }
    if (
        not isinstance(geometry_origin, dict)
        or set(geometry_origin) != required_origin_fields
        or not isinstance(geometry_origin.get("reference_context_phase_ids"), list)
        or not isinstance(geometry_origin.get("authored_feature_count"), int)
        or isinstance(geometry_origin.get("authored_feature_count"), bool)
        or not isinstance(
            geometry_origin.get("authored_geometry_membership_sha256"), str
        )
        or len(geometry_origin.get("authored_geometry_membership_sha256", "")) != 64
    ):
        raise ValueError(
            "Authoring profile geometry_origin must declare exact recipe membership"
        )
    return profile


def list_profiles(profiles_root: Path) -> list[dict[str, Any]]:
    """List valid registered profiles in stable profile-id order."""

    root = Path(profiles_root)
    if not root.is_dir():
        return []
    profiles: list[dict[str, Any]] = []
    for profile_dir in sorted(
        (path for path in root.iterdir() if path.is_dir()),
        key=lambda path: path.name,
    ):
        if not (profile_dir / "profile.json").is_file():
            continue
        profile = copy.deepcopy(_read_profile(profile_dir))
        validate_design_brief(profile["default_brief"], profile)
        profile["profile_version"] = profile["version"]
        profile["recipe_sha256"] = recipe_sha256(profile_dir)
        profiles.append(profile)
    return sorted(profiles, key=lambda row: row["profile_id"])


def validate_design_brief(
    brief: dict[str, Any], profile: dict[str, Any]
) -> dict[str, Any]:
    """Accept a goal variation while rejecting unimplemented design controls.

    The recipe is versioned and deterministic.  Site program, vertical design,
    and presentation changes need a new recipe version, not silent mutation of
    a brief that this compiler cannot honor.
    """

    if not isinstance(brief, dict):
        raise ValueError("Design brief must be a JSON object")
    default = profile.get("default_brief")
    if not isinstance(default, dict):
        raise ValueError("Authoring profile default_brief must be a JSON object")
    if set(brief) != set(default):
        raise ValueError("Design brief keys must exactly match the registered profile")
    goal = brief.get("goal")
    if not isinstance(goal, str) or not goal.strip():
        raise ValueError("Design brief goal must be a non-empty string")
    if len(goal.strip()) > 1000:
        raise ValueError("Design brief goal must be 1000 characters or fewer")
    for section in ("site_program", "vertical_design", "presentation"):
        if not _same_registered_value(brief.get(section), default.get(section)):
            raise ValueError(
                f"unsupported {section} change; create a new versioned semantic recipe"
            )
    validated = copy.deepcopy(default)
    validated["goal"] = goal.strip()
    return validated


def brief_sha256(brief: dict[str, Any]) -> str:
    """Return a key-order-independent digest of a design brief."""

    return hashlib.sha256(_canonical_bytes(brief)).hexdigest()


def recipe_sha256(profile_dir: Path) -> str:
    """Digest every registered profile asset by relative path and bytes."""

    profile_root = Path(profile_dir).resolve()
    if not profile_root.is_dir():
        raise ValueError(f"Authoring profile directory does not exist: {profile_root}")
    files = sorted(
        (
            path
            for path in profile_root.rglob("*")
            if path.is_file()
            and not any(
                part.startswith(".")
                for part in path.relative_to(profile_root).parts
            )
        ),
        key=lambda path: path.relative_to(profile_root).as_posix(),
    )
    if not files:
        raise ValueError(f"Authoring profile contains no recipe assets: {profile_root}")
    digest = hashlib.sha256()
    for path in files:
        relative = path.relative_to(profile_root).as_posix().encode("utf-8")
        payload = path.read_bytes()
        digest.update(len(relative).to_bytes(8, "big"))
        digest.update(relative)
        digest.update(len(payload).to_bytes(8, "big"))
        digest.update(payload)
    return digest.hexdigest()


def _relative_bundle_sources(
    sources: list[dict[str, Any]], recipe_root: Path
) -> list[dict[str, Any]]:
    normalized = copy.deepcopy(sources)
    root = recipe_root.resolve()
    for source in normalized:
        if source.get("lock", {}).get("kind") != "local_file":
            continue
        citation = Path(source.get("citation", ""))
        resolved = citation.resolve() if citation.is_absolute() else (root / citation).resolve()
        try:
            relative = resolved.relative_to(root)
        except ValueError as error:
            raise ValueError(
                f"Profile local source {source.get('id')} escapes the self-contained recipe"
            ) from error
        if not resolved.is_file():
            raise ValueError(f"Profile local source does not exist: {relative.as_posix()}")
        locked_sha = source.get("lock", {}).get("sha256")
        if locked_sha and hashlib.sha256(resolved.read_bytes()).hexdigest() != locked_sha:
            raise ValueError(f"Profile local source checksum mismatch: {source.get('id')}")
        source["citation"] = relative.as_posix()
        source["citation_scope"] = "project_bundle"
    return normalized


def compile_profile(
    profile_dir: Path,
    target_project: dict[str, str],
    brief: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Compile a registered semantic recipe into a new canonical bundle.

    Returned dictionaries are ready for ``project.json``, ``sources.lock.json``,
    and ``decisions.json``.  The caller copies the profile's ``recipe/source-data``
    directory beside those files before validation or publication.
    """

    profile_root = Path(profile_dir).resolve()
    profile = _read_profile(profile_root)
    validated_brief = validate_design_brief(brief, profile)
    if not isinstance(target_project, dict):
        raise ValueError("Target project must provide id and name")
    project_id = target_project.get("id")
    project_name = target_project.get("name")
    if not isinstance(project_id, str) or not project_id.strip():
        raise ValueError("Target project id must be a non-empty string")
    if not isinstance(project_name, str) or not project_name.strip():
        raise ValueError("Target project name must be a non-empty string")

    recipe_path = (profile_root / profile["recipe"]).resolve()
    recipe_root = recipe_path.parent
    model = load_project_bundle(recipe_path)
    if model.get("reviewed_source_adapter") is not None:
        raise ValueError("Original semantic recipes cannot contain a reviewed_source_adapter")
    if model.get("authoring_contract") != CUSTOM_AUTHORING_CONTRACT:
        raise ValueError("Original semantic recipe has an invalid custom authoring contract")

    model["project"]["id"] = project_id.strip()
    model["project"]["name"] = project_name.strip()
    model["project"]["goal"] = validated_brief["goal"]
    model["project"]["authoring_mode"] = CUSTOM_AUTHORING_CONTRACT["mode"]
    model["authoring_contract"] = copy.deepcopy(CUSTOM_AUTHORING_CONTRACT)
    current_recipe_sha256 = recipe_sha256(profile_root)
    expected_membership = copy.deepcopy(profile["geometry_origin"])
    actual_membership = custom_geometry_membership(
        model, expected_membership["reference_context_phase_ids"]
    )
    declared_membership = {
        "authored_feature_count": expected_membership["authored_feature_count"],
        "authored_geometry_membership_sha256": expected_membership[
            "authored_geometry_membership_sha256"
        ],
    }
    if actual_membership != declared_membership:
        raise ValueError(
            "Registered semantic recipe geometry differs from its profile membership receipt"
        )
    model["geometry_origin_receipt"] = {
        "schema_version": CUSTOM_GEOMETRY_ORIGIN_RECEIPT_SCHEMA,
        "origin": CUSTOM_GEOMETRY_ORIGIN,
        "recipe_sha256": current_recipe_sha256,
        "reference_context_phase_ids": copy.deepcopy(
            expected_membership["reference_context_phase_ids"]
        ),
        **declared_membership,
    }
    model["custom_authoring"] = {
        "schema_version": _CUSTOM_AUTHORING_SCHEMA,
        "profile_id": profile["profile_id"],
        "profile_version": profile["version"],
        "brief": copy.deepcopy(validated_brief),
        "brief_sha256": brief_sha256(validated_brief),
        "recipe_sha256": current_recipe_sha256,
    }
    model.pop("reviewed_source_adapter", None)

    validation_errors = [
        issue for issue in validate_model(model) if issue.severity == "error"
    ]
    if validation_errors:
        summary = "; ".join(
            f"{issue.code}: {issue.message}" for issue in validation_errors[:5]
        )
        raise ValueError(f"Registered semantic recipe failed canonical validation: {summary}")

    sources = {
        "schema_version": "civil-plan-factory.source-ledger/v0.1.0",
        "disclaimer": model.get("disclaimer") or model["project"].get("disclaimer"),
        "sources": _relative_bundle_sources(model.pop("sources"), recipe_root),
    }
    decisions = {
        "schema_version": "civil-plan-factory.decision-ledger/v0.1.0",
        "disclaimer": model.get("disclaimer") or model["project"].get("disclaimer"),
        "decisions": copy.deepcopy(model.pop("decisions")),
    }
    model["source_ledger"] = "sources.lock.json"
    model["decision_ledger"] = "decisions.json"
    return model, sources, decisions


def authored_bundle_sha256(
    project: dict[str, Any],
    sources: dict[str, Any],
    decisions: dict[str, Any],
) -> str:
    """Digest the three canonical authored-bundle dictionaries."""

    canonical_project = copy.deepcopy(project)
    for marker_name in ("custom_authoring", "custom_plan_authoring"):
        marker = canonical_project.get(marker_name)
        if isinstance(marker, dict):
            marker.pop("authored_bundle_sha256", None)
    return hashlib.sha256(
        _canonical_bytes(
            {
                "project": canonical_project,
                "sources": sources,
                "decisions": decisions,
            }
        )
    ).hexdigest()
