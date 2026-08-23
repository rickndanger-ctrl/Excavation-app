"""Derived presentation helpers for canonical vertical-design attributes."""

from __future__ import annotations

from typing import Any


def _range(values: list[float]) -> str:
    return f"{min(values):.2f}-{max(values):.2f}"


def vertical_callout(feature: dict[str, Any]) -> str | None:
    """Format a field callout from numeric controls without duplicating values."""

    detail = feature.get("field_detail", {})
    if "finished_floor_elevation_ft" in detail:
        ffe = float(detail["finished_floor_elevation_ft"])
        subgrade = detail.get("building_subgrade_elevation_ft")
        if subgrade is not None:
            return f"FFE {ffe:.2f} / PAD SG {float(subgrade):.2f}"
        return f"FFE {ffe:.2f}"
    if "threshold_elevation_ft" in detail:
        threshold = float(detail["threshold_elevation_ft"])
        landing = detail.get("exterior_landing_elevation_ft")
        if landing is not None:
            return f"THRESH {threshold:.2f} / LANDING {float(landing):.2f}"
        return f"THRESH {threshold:.2f}"
    if "subgrade_elevation_ft" in detail:
        return f"PAD SG {float(detail['subgrade_elevation_ft']):.2f}"
    if profile := detail.get("vertical_profile"):
        low = float(profile["low_elevation_ft"])
        high = float(profile["high_elevation_ft"])
        slope = float(profile["slope_percent"])
        return f"FG {low:.2f}-{high:.2f} / SLOPE {slope:.2f}%"
    controls = detail.get("grade_controls", [])
    if controls and all("gutter_elevation_ft" in item for item in controls):
        gutters = [float(item["gutter_elevation_ft"]) for item in controls]
        reveal = float(detail["curb_reveal_ft"])
        return f"TC = GUTTER + {reveal:.2f} FT / GUTTER {_range(gutters)}"
    elevations = [
        float(item["elevation_ft"])
        for item in controls
        if "elevation_ft" in item
    ]
    if elevations:
        callout = f"FG {_range(elevations)}"
        drainage = detail.get("drainage_direction")
        if drainage == "southwest":
            callout += " / DRAINS SW"
        elif drainage == "toward storm planter":
            callout += " / DRAINS TO PLANTER"
        return callout
    return None


def field_detail_with_vertical_callout(feature: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of field detail with a deterministic display callout."""

    detail = dict(feature.get("field_detail", {}))
    if callout := vertical_callout(feature):
        detail["vertical_callout"] = callout
    return detail


def utility_vertical_callout(edge: dict[str, Any]) -> str | None:
    """Format utility verticals from the edge's numeric profile controls."""

    detail = edge.get("field_detail", {})
    surfaces = detail.get("surface_samples_ft")
    if surfaces and detail.get("centerline_elevation_samples_ft"):
        centerlines = detail["centerline_elevation_samples_ft"]
        covers = detail.get("cover_samples_ft", [])
        cover_text = (
            f"{float(covers[0]):.2f}"
            if covers and min(covers) == max(covers)
            else _range([float(value) for value in covers])
        )
        return (
            f"FG {_range([float(value) for value in surfaces])} / "
            f"CL {_range([float(value) for value in centerlines])} / "
            f"COVER {cover_text} FT"
        )
    if surfaces and detail.get("utility_top_elevation_samples_ft"):
        utility_tops = detail["utility_top_elevation_samples_ft"]
        cover = float(detail["modeled_cover_ft"])
        return (
            f"FG {_range([float(value) for value in surfaces])} / "
            f"TOP {_range([float(value) for value in utility_tops])} / "
            f"COVER {cover:.2f} FT"
        )
    if all(key in detail for key in ("upstream_invert_ft", "downstream_invert_ft")):
        callout = (
            f"INV {float(detail['upstream_invert_ft']):.2f}"
            f"→{float(detail['downstream_invert_ft']):.2f}"
        )
        if "slope_percent" in detail:
            callout += f" / SLOPE {float(detail['slope_percent']):.2f}%"
        return callout
    return None


def edge_field_detail_with_vertical_callout(edge: dict[str, Any]) -> dict[str, Any]:
    """Return edge field detail with its deterministic vertical callout."""

    detail = dict(edge.get("field_detail", {}))
    if callout := utility_vertical_callout(edge):
        detail["vertical_callout"] = callout
    return detail
