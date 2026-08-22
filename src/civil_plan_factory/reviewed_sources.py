"""Checksum-keyed adapters for previously reviewed source-plan evidence.

Adapters translate a locked source and its recorded human review into the
canonical producer contract.  They do not infer new engineering facts.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any, Callable

from .validation import DISCLAIMER, REQUIRED_SYSTEMS, SEMANTIC_REVIEW_GRID_BASIS


READING_PLAN_SHA256 = "835e28d8d981b4c0a0c5840e006c4cc19f259fc7fcb218ddc744bfec97da97d1"


@dataclass(frozen=True)
class ReviewedSourceAdapter:
    adapter_id: str
    title: str
    source_sha256: str
    build: Callable[[dict[str, Any], dict[str, Any]], tuple[dict[str, Any], dict[str, Any], dict[str, Any]]]


def _review_coordinates(point: tuple[float, float]) -> list[float]:
    """Convert the consumer's y-down review grid to canonical y-up coordinates."""

    return [point[0], 80 - point[1]]


def _feature_provenance(source_id: str, decision_id: str) -> dict[str, Any]:
    return {
        "status": "reference-derived",
        "source_ids": [source_id],
        "decision_ids": [decision_id],
    }


def _review_detail(
    *,
    confidence: str,
    sheet: str,
    pdf_page: int,
    extraction: str,
    source_text: list[str],
    source_item_indexes: list[int],
    source_review_coordinates: Any,
    values: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "searchable": True,
        "review_status": "approved",
        "confidence": confidence,
        "sheet": sheet,
        "pdf_page": pdf_page,
        "extraction": extraction,
        "source_text": source_text,
        "source_item_indexes": source_item_indexes,
        "source_review_coordinates": source_review_coordinates,
        "coordinate_status": "uncalibrated_sheet_space",
        **(values or {}),
    }


def _point(
    *,
    feature_id: str,
    feature_type: str,
    layer_id: str,
    system: str,
    label: str,
    review_point: tuple[float, float],
    source_id: str,
    decision_id: str,
    confidence: str,
    sheet: str,
    pdf_page: int,
    extraction: str,
    source_text: list[str],
    source_item_indexes: list[int] | None = None,
    values: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "id": feature_id,
        "feature_type": feature_type,
        "system": system,
        "layer_id": layer_id,
        "phase_id": "reviewed-source",
        "label": label,
        "coordinates": _review_coordinates(review_point),
        "field_detail": _review_detail(
            confidence=confidence,
            sheet=sheet,
            pdf_page=pdf_page,
            extraction=extraction,
            source_text=source_text,
            source_item_indexes=source_item_indexes or [],
            source_review_coordinates=list(review_point),
            values=values,
        ),
        "provenance": _feature_provenance(source_id, decision_id),
    }


def _line(
    *,
    feature_id: str,
    feature_type: str,
    layer_id: str,
    system: str,
    label: str,
    review_coordinates: list[list[float]],
    source_id: str,
    decision_id: str,
    sheet: str,
    pdf_page: int,
    source_text: list[str],
    confidence: str = "medium",
    values: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "id": feature_id,
        "feature_type": feature_type,
        "system": system,
        "layer_id": layer_id,
        "phase_id": "reviewed-source",
        "label": label,
        "coordinates": [
            _review_coordinates((point[0], point[1]))
            for point in review_coordinates
        ],
        "field_detail": _review_detail(
            confidence=confidence,
            sheet=sheet,
            pdf_page=pdf_page,
            extraction="manual_vector_review",
            source_text=source_text,
            source_item_indexes=[],
            source_review_coordinates=review_coordinates,
            values=values,
        ),
        "provenance": _feature_provenance(source_id, decision_id),
    }


def _polygon(
    *,
    feature_id: str,
    feature_type: str,
    system: str,
    label: str,
    review_coordinates: list[list[float]],
    source_id: str,
    decision_id: str,
    source_text: list[str],
    values: dict[str, Any] | None = None,
) -> dict[str, Any]:
    feature = _line(
        feature_id=feature_id,
        feature_type=feature_type,
        layer_id="finished-site",
        system=system,
        label=label,
        review_coordinates=review_coordinates,
        source_id=source_id,
        decision_id=decision_id,
        sheet="L1.1",
        pdf_page=5,
        source_text=source_text,
        values=values,
    )
    return feature


def _finished_site_features(
    source_id: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Return the manually reviewed L1.1/L2.1 geometry, not inferred design."""

    decision_id = "review-reading-finished-site"
    polygons = [
        _polygon(
            feature_id="reading-library-footprint",
            feature_type="building_footprint",
            system="buildings_pads",
            label="Reading Public Library",
            review_coordinates=[[29, 23], [72, 23], [72, 43], [29, 43], [29, 23]],
            source_id=source_id,
            decision_id=decision_id,
            source_text=["READING PUBLIC LIBRARY", "2 STORY MIXED MATERIAL"],
            values={"scope": "Existing library footprint shown as the central orientation feature on L1.1."},
        ),
        _polygon(
            feature_id="reading-existing-west-concrete-walk",
            feature_type="existing_concrete_walk",
            system="sidewalks",
            label="West library walk and paved entrance",
            review_coordinates=[
                [8, 20], [29, 20], [29, 43], [20, 43], [17, 47],
                [12, 51], [8, 56], [6, 51], [10, 42], [8, 20],
            ],
            source_id=source_id,
            decision_id=decision_id,
            source_text=["PAVED", "CONCRETE STEPS", "READING PUBLIC LIBRARY"],
            values={"material": "existing paved/concrete context"},
        ),
        _polygon(
            feature_id="reading-proposed-concrete-walk",
            feature_type="cement_concrete_pavement",
            system="paving",
            label="Proposed concrete terrace walk",
            review_coordinates=[
                [72, 23], [86, 20], [94, 25], [98, 44], [94, 51],
                [83, 47], [72, 43], [72, 23],
            ],
            source_id=source_id,
            decision_id=decision_id,
            source_text=["CEMENT CONCRETE PAVEMENT"],
            values={"material": "cement concrete", "detail_reference": "1/L4.1"},
        ),
        _polygon(
            feature_id="reading-proposed-unit-paver-terrace",
            feature_type="unit_paver_area",
            system="paving",
            label="Proposed unit-paver terrace",
            review_coordinates=[[74, 37], [86, 37], [86, 46], [74, 46], [74, 37]],
            source_id=source_id,
            decision_id=decision_id,
            source_text=["UNIT PAVERS", "18.0'", "12.0'"],
            values={"material": "unit pavers", "detail_reference": "2/L4.1"},
        ),
        _polygon(
            feature_id="reading-proposed-planting-bed-north",
            feature_type="planting_area",
            system="grading",
            label="Upper terrace planting bed",
            review_coordinates=[[72, 19], [84, 18], [89, 22], [88, 31], [73, 31], [72, 19]],
            source_id=source_id,
            decision_id=decision_id,
            source_text=["LOAM AND SEED", "PLANTING PLAN AND DETAILS"],
            values={"source_cross_reference": "L3.1"},
        ),
        _polygon(
            feature_id="reading-proposed-planting-bed-south",
            feature_type="planting_area",
            system="grading",
            label="Lower terrace planting bed",
            review_coordinates=[[72, 47], [87, 47], [94, 51], [90, 57], [71, 51], [72, 47]],
            source_id=source_id,
            decision_id=decision_id,
            source_text=["LOAM AND SEED", "PLANTING PLAN AND DETAILS"],
            values={"source_cross_reference": "L3.1"},
        ),
        _polygon(
            feature_id="reading-existing-south-lawn",
            feature_type="existing_lawn_area",
            system="landscape",
            label="South library lawn",
            review_coordinates=[
                [10, 44], [29, 43], [72, 43], [83, 47], [94, 51],
                [101, 61], [96, 66], [10, 66], [7, 58], [10, 44],
            ],
            source_id=source_id,
            decision_id=decision_id,
            source_text=["GRASS", "LANDSCAPE AREA", "SCHOOL STREET"],
            values={"material": "existing lawn/landscape context"},
        ),
        _polygon(
            feature_id="reading-existing-south-sidewalk",
            feature_type="existing_concrete_sidewalk",
            system="sidewalks",
            label="School Street sidewalk",
            review_coordinates=[[4, 66], [108, 66], [111, 72], [3, 72], [4, 66]],
            source_id=source_id,
            decision_id=decision_id,
            source_text=["CONCRETE", "SCHOOL STREET", "GRANITE CURB"],
            values={"material": "existing concrete sidewalk"},
        ),
        _polygon(
            feature_id="reading-existing-east-sidewalk",
            feature_type="existing_concrete_sidewalk",
            system="sidewalks",
            label="Middlesex Avenue sidewalk",
            review_coordinates=[[103, 12], [109, 12], [109, 69], [103, 66], [103, 12]],
            source_id=source_id,
            decision_id=decision_id,
            source_text=["CONCRETE", "MIDDLESEX AVENUE", "GRANITE CURB"],
            values={"material": "existing concrete sidewalk"},
        ),
    ]
    lines = [
        _line(
            feature_id="reading-limit-of-work",
            feature_type="limit_of_work",
            layer_id="finished-site",
            system="construction_erosion",
            label="Approximate limit of work",
            review_coordinates=[[70, 17], [91, 17], [102, 55], [69, 54], [70, 17]],
            source_id=source_id,
            decision_id=decision_id,
            sheet="L1.1",
            pdf_page=5,
            source_text=["APPROXIMATE LIMIT OF WORK"],
        ),
        *[
            _line(
                feature_id=feature_id,
                feature_type="stone_seat_wall",
                layer_id="finished-site",
                system="structures",
                label=label,
                review_coordinates=coordinates,
                source_id=source_id,
                decision_id=decision_id,
                sheet="L1.1",
                pdf_page=5,
                source_text=["PRE-ENGINEERED STONE SEAT WALL SYSTEM"],
                values={"detail_reference": "3/L4.1"},
            )
            for feature_id, label, coordinates in (
                ("reading-seat-wall-upper", "Upper stone seat wall", [[74, 25], [86, 25]]),
                ("reading-seat-wall-middle", "Middle stone seat wall", [[74, 29], [87, 29]]),
                ("reading-seat-wall-lower", "Lower stone seat wall", [[74, 33], [88, 33]]),
            )
        ],
        _line(
            feature_id="reading-east-granite-curb",
            feature_type="existing_granite_curb",
            layer_id="finished-site",
            system="curbs",
            label="Middlesex Avenue granite curb",
            review_coordinates=[[111, 12], [111, 72]],
            source_id=source_id,
            decision_id=decision_id,
            sheet="L1.1",
            pdf_page=5,
            source_text=["GRANITE CURB", "MIDDLESEX AVENUE"],
        ),
        _line(
            feature_id="reading-south-granite-curb",
            feature_type="existing_granite_curb",
            layer_id="finished-site",
            system="curbs",
            label="School Street granite curb",
            review_coordinates=[[3, 74], [112, 74]],
            source_id=source_id,
            decision_id=decision_id,
            sheet="L1.1",
            pdf_page=5,
            source_text=["GRANITE CURB", "SCHOOL STREET"],
        ),
        _line(
            feature_id="reading-terrace-stair-upper",
            feature_type="concrete_steps",
            layer_id="finished-site",
            system="sidewalks",
            label="Upper terrace steps",
            review_coordinates=[[72, 34], [75, 34], [75, 37]],
            source_id=source_id,
            decision_id=decision_id,
            sheet="L1.1",
            pdf_page=5,
            source_text=["CONCRETE STEPS", "5.0'", "6.0'"],
        ),
        _line(
            feature_id="reading-terrace-stair-lower",
            feature_type="concrete_steps",
            layer_id="finished-site",
            system="sidewalks",
            label="Lower terrace steps",
            review_coordinates=[[72, 46], [75, 46], [75, 49]],
            source_id=source_id,
            decision_id=decision_id,
            sheet="L1.1",
            pdf_page=5,
            source_text=["CONCRETE STEPS", "5.0'", "6.0'"],
        ),
        *[
            _line(
                feature_id=f"reading-proposed-contour-{elevation}",
                feature_type="reviewed_proposed_contour_reference",
                layer_id="grading",
                system="grading",
                label=f"Proposed contour {elevation}",
                review_coordinates=coordinates,
                source_id=source_id,
                decision_id="review-reading-grading",
                sheet="L2.1",
                pdf_page=6,
                source_text=["PROPOSED 1' CONTOUR", str(elevation)],
                values={"elevation_ft": elevation},
            )
            for elevation, coordinates in (
                (155, [[15, 61], [28, 57], [43, 59], [57, 63]]),
                (156, [[15, 52], [29, 48], [44, 50], [56, 54]]),
                (157, [[18, 43], [30, 39], [46, 42], [56, 47]]),
            )
        ],
    ]
    surface_review_boundary = [[70, 17], [91, 17], [102, 55], [69, 54], [70, 17]]
    surfaces = [{
        "id": "reading-proposed-terrace-finish-grade",
        "feature_type": "reviewed_finish_grade_envelope",
        "system": "grading",
        "layer_id": "grading",
        "phase_id": "reviewed-source",
        "label": "Proposed terrace finish-grade surface · sparse source controls",
        "boundary": [
            _review_coordinates((point[0], point[1]))
            for point in surface_review_boundary
        ],
        "vertical_datum": "SOURCE_PLAN_DATUM_UNVERIFIED",
        "field_detail": _review_detail(
            confidence="medium",
            sheet="L2.1",
            pdf_page=6,
            extraction="manual_vector_review",
            source_text=["PROPOSED 1' CONTOUR", "PROPOSED SPOT GRADE", "PROPOSED SLOPE DIRECTION"],
            source_item_indexes=[],
            source_review_coordinates=surface_review_boundary,
            values={
                "surface_status": "bounded_sparse_source_controls",
                "unavailable": {
                    "triangulation": "No calibrated TIN or staking surface is claimed.",
                },
            },
        ),
        "provenance": _feature_provenance(source_id, "review-reading-grading"),
    }]
    return polygons, lines, surfaces


def _grading_points(source_id: str) -> list[dict[str, Any]]:
    decision_id = "review-reading-grading"
    rows = [
        (13, "slope", "Slope 4.9%", (51.747, 53.319), ["4.9%"], {"slope_percent": 4.9}),
        (15, "spot_elevation", "Spot elevation 154.19", (59.372, 71), ["154.19"], {"elevation_ft": 154.19}),
        (17, "spot_elevation", "Spot elevation 155.21", (48.232, 32.984), ["155.21"], {"elevation_ft": 155.21}),
        (18, "spot_elevation", "Spot elevation 155.27", (60.351, 33.412), ["155.27"], {"elevation_ft": 155.27}),
        (20, "spot_elevation", "Spot elevation 155.21", (15.155, 36.264), ["155.21"], {"elevation_ft": 155.21}),
        (22, "spot_elevation", "Spot elevation 155.33", (60.309, 30.903), ["155.33"], {"elevation_ft": 155.33}),
        (36, "spot_elevation", "Spot elevation 155.27", (48.146, 29.562), ["155.27"], {"elevation_ft": 155.27}),
        (38, "slope", "Slope 1.5%", (30.426, 46.074), ["1.5%"], {"slope_percent": 1.5}),
        (40, "slope", "Slope 1.5%", (27.486, 32.928), ["1.5%"], {"slope_percent": 1.5}),
        (42, "wall", "Wall BW 155.27 / TW 156.77", (9, 24.772), ["BW 155.27", "TW 156.77"], {"bottom_wall_ft": 155.27, "top_wall_ft": 156.77}),
        (45, "spot_elevation", "Spot elevation 155.21", (23.952, 36.52), ["155.21"], {"elevation_ft": 155.21}),
        (46, "spot_elevation", "Spot elevation 155.21", (40.33, 36.52), ["155.21"], {"elevation_ft": 155.21}),
        (48, "spot_elevation", "Spot elevation 155.03", (23.952, 53.061), ["155.03"], {"elevation_ft": 155.03}),
        (49, "spot_elevation", "Spot elevation 155.03", (40.33, 53.147), ["155.03"], {"elevation_ft": 155.03}),
        (51, "wall", "Wall BW 156.83 / TW 158.33", (21.353, 23.972), ["BW 156.83", "TW 158.33"], {"bottom_wall_ft": 156.83, "top_wall_ft": 158.33}),
        (54, "wall", "Wall BW 158.39 / TW 159.89", (23.845, 16.729), ["BW 158.39", "TW 159.89"], {"bottom_wall_ft": 158.39, "top_wall_ft": 159.89}),
        (57, "wall", "Wall BW 159.95 / TW 161.45", (26.486, 9), ["BW 159.95", "TW 161.45"], {"bottom_wall_ft": 159.95, "top_wall_ft": 161.45}),
        (65, "rim", "Lower existing cleanout rim to 155.29", (111, 34.98), ["LOWER EXISTING CLEANOUT", "RIM ELEVATION TO 155.29"], {"elevation_ft": 155.29}),
        (73, "rim", "Raise existing DMH rim to 155.00", (25.804, 63.528), ["RAISE EXISTING", "DMH RIM TO", "ELEVATION 155.00"], {"elevation_ft": 155.0}),
        (77, "slope", "Slope 1.5%", (53.025, 63.157), ["1.5%"], {"slope_percent": 1.5}),
    ]
    kind_map = {
        "slope": ("slope_marker", "slope"),
        "spot_elevation": ("elevation", "spot_elevation"),
        "wall": ("wall_elevation_pair", "wall_elevation_pair"),
        "rim": ("rim_adjustment", "rim_adjustment"),
    }
    result = []
    for index, kind, label, point, source_text, values in rows:
        feature_type, id_kind = kind_map[kind]
        item_indexes = [index, index + 1] if kind == "wall" else [index]
        if index == 65:
            item_indexes = [65, 66]
        elif index == 73:
            item_indexes = [73, 74, 75]
        result.append(_point(
            feature_id=f"l2.1-{id_kind}-{index}",
            feature_type=feature_type,
            layer_id="grading",
            system="grading",
            label=label,
            review_point=point,
            source_id=source_id,
            decision_id=decision_id,
            confidence="high",
            sheet="L2.1",
            pdf_page=6,
            extraction="native_pdf_text",
            source_text=source_text,
            source_item_indexes=item_indexes,
            values=values,
        ))
    return result


def _sanitary_features(source_id: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    decision_id = "review-reading-sanitary"
    points = [
        _point(
            feature_id="survey-smh-west", feature_type="manhole", layer_id="sanitary",
            system="sanitary", label="Existing sewer manhole · RIM 162.54 · IN 154.49 · OUT 154.44",
            review_point=(34, 28), source_id=source_id, decision_id=decision_id,
            confidence="medium", sheet="Topographic Survey", pdf_page=2,
            extraction="manual_vector_review",
            source_text=["SMH", "RIM=162.54", "IN=154.49", "OUT=154.44"],
            values={"rim_elevation_ft": 162.54, "invert_in_ft": 154.49, "invert_out_ft": 154.44},
        ),
        _point(
            feature_id="survey-smh-east", feature_type="manhole", layer_id="sanitary",
            system="sanitary", label="Existing sewer manhole · attributes not shown",
            review_point=(76, 35), source_id=source_id, decision_id=decision_id,
            confidence="medium", sheet="Topographic Survey", pdf_page=2,
            extraction="manual_vector_review", source_text=["S sewer-manhole symbol"],
            values={"unavailable": {"attributes": "Rim and invert elevations are not shown."}},
        ),
        _point(
            feature_id="survey-cleanout", feature_type="cleanout", layer_id="sanitary",
            system="sanitary", label="Existing cleanout · RIM 156.85 · 6-inch PVC · could not open",
            review_point=(52, 66), source_id=source_id, decision_id=decision_id,
            confidence="medium", sheet="Topographic Survey", pdf_page=2,
            extraction="manual_vector_review",
            source_text=["CLEAN OUT", "RIM=156.85", "6” PVC", "COULD NOT OPEN"],
            values={"rim_elevation_ft": 156.85, "pipe_size": "6-in", "material": "PVC", "note": "Could not open"},
        ),
    ]
    original = [[34, 28], [76, 35]]
    line = {
        "id": "survey-sewer-run",
        "feature_type": "sanitary_pipe",
        "system": "sanitary",
        "layer_id": "sanitary",
        "phase_id": "reviewed-source",
        "label": "Existing sewer · 8-inch PVC",
        "coordinates": [_review_coordinates(tuple(point)) for point in original],
        "field_detail": _review_detail(
            confidence="medium", sheet="Topographic Survey", pdf_page=2,
            extraction="manual_vector_review", source_text=["S", "8” PVC", "S"],
            source_item_indexes=[], source_review_coordinates=original,
            values={
                "pipe_size": "8-in", "material": "PVC",
                "unavailable": {
                    "connectivity": "No explicit network connectivity is claimed.",
                    "slope": "Pipe slope is not established by the reviewed evidence.",
                },
            },
        ),
        "provenance": _feature_provenance(source_id, decision_id),
    }
    return points, [line]


def _storm_points(source_id: str) -> list[dict[str, Any]]:
    rows = [
        ("survey-dmh-rim-162-55", "manhole", "DMH · RIM 162.55 · A 150.45 · B 150.35", (25, 18), {"rim_elevation_ft": 162.55, "invert_in_ft": [150.45, 150.35], "note": "Adjacent 30-inch CPP evidence; connectivity withheld."}),
        ("survey-dmh-rim-162-64", "manhole", "DMH · RIM 162.64 · A 157.19 · B 146.94 · OUT 146.69", (45, 22), {"rim_elevation_ft": 162.64, "invert_in_ft": [157.19, 146.94], "invert_out_ft": 146.69}),
        ("survey-dmh-rim-153-73", "manhole", "DMH · RIM 153.73 · A 143.68 · B 143.28 · OUT 143.25", (66, 25), {"rim_elevation_ft": 153.73, "invert_in_ft": [143.68, 143.28], "invert_out_ft": 143.25}),
        ("survey-cb-rim-152-93", "catch_basin", "CB · RIM 152.93 · OUT 149.38", (82, 34), {"rim_elevation_ft": 152.93, "invert_out_ft": 149.38}),
        ("survey-cb-rim-151-65", "catch_basin", "CB · RIM 151.65 · OUT 148.70", (73, 48), {"rim_elevation_ft": 151.65, "invert_out_ft": 148.70}),
        ("survey-dmh-rim-151-91", "manhole", "DMH · RIM 151.91 · A 147.81 · B 147.91 · OUT 147.66", (58, 55), {"rim_elevation_ft": 151.91, "invert_in_ft": [147.81, 147.91], "invert_out_ft": 147.66}),
        ("survey-dmh-rim-151-72", "manhole", "DMH · RIM 151.72 · A 140.87 · B 140.87 · OUT 140.84", (40, 60), {"rim_elevation_ft": 151.72, "invert_in_ft": [140.87, 140.87], "invert_out_ft": 140.84}),
        ("survey-storm-ceptor", "manhole", "STORM CEPTOR · RIM 149.18 · IN 140.80 · OUT 140.88", (26, 67), {"rim_elevation_ft": 149.18, "invert_in_ft": [140.80], "invert_out_ft": 140.88, "note": "Source label reads STORM CEPTOR."}),
        ("survey-street-dmh", "manhole", "Street DMH · RIM 146.04 · IN 139.94 · OUT 139.74", (14, 74), {"rim_elevation_ft": 146.04, "invert_in_ft": [139.94], "invert_out_ft": 139.74}),
    ]
    return [
        _point(
            feature_id=feature_id, feature_type=feature_type, layer_id="storm", system="storm",
            label=label, review_point=point, source_id=source_id,
            decision_id="review-reading-storm", confidence="medium", sheet="Topographic Survey",
            pdf_page=2, extraction="manual_vector_review", source_text=[label], values=values,
        )
        for feature_id, feature_type, label, point, values in rows
    ]


def _water_points(source_id: str) -> list[dict[str, Any]]:
    return [
        _point(
            feature_id=feature_id, feature_type="gate_valve", layer_id="water", system="water",
            label="Existing water gate · southeast Middlesex Avenue frontage",
            review_point=point, source_id=source_id, decision_id="review-reading-water",
            confidence="medium", sheet="Topographic Survey", pdf_page=2,
            extraction="manual_vector_review", source_text=["WG"],
            values={"unavailable": {"main_geometry": "Water-main geometry and connectivity are unavailable."}},
        )
        for feature_id, point in (
            ("survey-wg-southeast-west", (86, 68)),
            ("survey-wg-southeast-east", (93, 72)),
        )
    ]


def _dry_utility_points(source_id: str) -> list[dict[str, Any]]:
    return [
        _point(
            feature_id=feature_id, feature_type="light_bollard", layer_id="dry-utilities",
            system="site_lighting", label="Existing LIGHT BOLLARD · west walk",
            review_point=point, source_id=source_id, decision_id="review-reading-dry-utilities",
            confidence="medium", sheet="Topographic Survey", pdf_page=2,
            extraction="manual_vector_review", source_text=["LIGHT BOLLARD"],
            values={"unavailable": {"connectivity": "No electrical ownership, voltage, or connectivity is established."}},
        )
        for feature_id, point in (
            ("survey-light-bollard-west-north", (18, 40)),
            ("survey-light-bollard-west-south", (21, 47)),
        )
    ]


def _coverage() -> list[dict[str, Any]]:
    partial = {
        "surfaces": "Three proposed contour traces and the bounded terrace finish-grade review surface are modeled; a calibrated TIN remains unavailable.",
        "sanitary": "Two manholes, one cleanout, and one 8-inch PVC segment are reviewed; topology, slope, and unshown attributes remain unavailable.",
        "storm": "Seven drainage manholes and two catch basins are reviewed; 12-inch RCP and 30-inch CPP traces and connectivity are withheld.",
        "domestic_water": "Two water gates are reviewed; the water main, size, depth, hydrants, and connectivity are unavailable.",
        "site_lighting": "Two light bollards are reviewed; OHW and pole geometry, ownership, voltage, and connectivity are withheld.",
        "structures": "Reviewed sanitary and storm structures plus the three proposed terrace seat-wall runs are represented with source-backed attributes.",
        "grading": "Twenty approved L2.1 annotations, three proposed contour traces, and the bounded terrace surface are represented; this is not a staking model.",
        "buildings_pads": "The full existing library footprint is retained as the central orientation feature; no new building or pad is proposed by this plan set.",
        "sidewalks": "The proposed terrace walk and the major existing west, School Street, and Middlesex Avenue walks are modeled from L1.1 as finished-site context.",
        "paving": "The proposed cement-concrete and unit-paver areas plus the major existing paved entrance context are modeled from L1.1.",
        "construction_erosion": "The approximate limit of work is modeled; temporary means and methods remain contractor-controlled.",
        "materials_specifications": "Only the source-labeled 8-inch PVC sewer segment and 6-inch PVC cleanout note are retained.",
        "plans_profiles_sections_schedules": "A semantic reviewed-source plan is generated; profiles, sections, schedules, and georeferenced plans are unavailable.",
        "field_details_workflows_checklists": "Source evidence, confidence, and unavailable fields are exposed; construction workflows and checklists are not authored.",
    }
    reasons = {
        "coordinates_control": "No calibrated horizontal CRS, survey control, or field-coordinate transform is established.",
        "property_limits": "Property limits were not reviewed into this adapter.",
        "easements_row_resource_limits": "Easements, right-of-way, and resource limits were not reviewed into this adapter.",
        "fire_water": "No mapped fire-water assets are established by the reviewed evidence.",
        "gas": "No mapped gas assets are established by the reviewed evidence.",
        "power": "OHW and utility-pole evidence remain pending safe trace and system classification.",
        "telecom_fiber": "Legend entries and generic utility marks do not establish mapped telecom or fiber assets.",
        "roof_drainage": "No roof-drainage system is established by the reviewed evidence.",
        "curbs": "Curb geometry was not reviewed into this adapter.",
        "ada": "No accessibility geometry or compliance determination is claimed.",
        "demolition": "No demolition scope was reviewed into this adapter.",
        "construction_erosion": "No erosion-control or temporary-construction design was reviewed into this adapter.",
        "relationships": "Network connectivity and other asset relationships are explicitly withheld where the source review did not establish them.",
    }
    result = []
    for system in sorted(REQUIRED_SYSTEMS):
        if system in partial:
            result.append({
                "system": system,
                "availability": "partial",
                "provenance_status": "reference-derived",
                "reason": partial[system],
            })
        else:
            result.append({
                "system": system,
                "availability": "declared_unavailable",
                "provenance_status": "unknown",
                "reason": reasons[system],
            })
    return result


def _decisions(source_id: str) -> list[dict[str, Any]]:
    return [
        {
            "id": "review-reading-spatial-basis",
            "subject": "Reading source coordinate basis",
            "status": "unknown",
            "value": {"horizontal": "uncalibrated sheet-space review grid", "vertical_datum": "unverified"},
            "rationale": "The reviewed evidence provides sheet annotations and approximate review locations, not calibrated field control.",
            "source_ids": [source_id],
        },
        {
            "id": "review-reading-finished-site",
            "subject": "L1.1 finished-site geometry review",
            "status": "reference-derived",
            "value": {
                "approved_area_count": 9,
                "approved_line_count": 8,
                "scope": [
                    "full existing library footprint",
                    "west paved entrance and walk",
                    "proposed cement-concrete walk",
                    "proposed unit-paver terrace",
                    "two proposed planting beds",
                    "south lawn context",
                    "School Street sidewalk",
                    "Middlesex Avenue sidewalk",
                    "approximate limit of work",
                    "three proposed seat-wall runs",
                    "two major granite curb edges",
                    "two terrace step connections",
                ],
                "withheld_geometry": [
                    "unlabeled inferred edges",
                    "field coordinates",
                    "staking offsets",
                ],
            },
            "rationale": "The recognizable building, principal walks, terrace materials, landscape context, curbs, steps, work limit, and seat walls were manually reviewed from L1.1 so field layers retain visual relation to the finished job.",
            "source_ids": [source_id],
        },
        {
            "id": "review-reading-grading",
            "subject": "L2.1 grading annotation review",
            "status": "reference-derived",
            "value": {
                "approved_count": 20,
                "rejected_candidate_ids": ["l2.1-grading-note-68", "l2.1-grading-note-80"],
                "approved_geometry": ["three proposed contour traces", "bounded sparse-control finish-grade surface"],
                "withheld_geometry": ["untraced contours", "breaklines", "leader-line associations", "calibrated TIN"],
            },
            "rationale": "Only ten spot elevations, four BW/TW pairs, four slopes, and two rim adjustments passed review.",
            "source_ids": [source_id],
        },
        {
            "id": "review-reading-sanitary",
            "subject": "Topographic Survey sanitary review",
            "status": "reference-derived",
            "value": {
                "approved_count": 4,
                "excluded": ["L2.1 DMH is drainage, not sanitary", "SP1.1 generic drain line is not sanitary"],
                "withheld_geometry": ["unshown structures", "network connectivity", "slope"],
            },
            "rationale": "The signed survey review supports exactly two manholes, one cleanout, and one 8-inch PVC segment.",
            "source_ids": [source_id],
        },
        {
            "id": "review-reading-storm",
            "subject": "Topographic Survey storm review",
            "status": "reference-derived",
            "value": {
                "approved_count": 9,
                "withheld_geometry": ["12-inch RCP", "30-inch CPP", "pipe connectivity", "flow direction"],
            },
            "rationale": "Seven drainage manholes and two catch basins are source-backed; pipe traces are not defensible yet.",
            "source_ids": [source_id],
        },
        {
            "id": "review-reading-water",
            "subject": "Topographic Survey water review",
            "status": "reference-derived",
            "value": {
                "approved_count": 2,
                "withheld_geometry": ["water main geometry", "hydrants", "size", "depth", "connectivity"],
            },
            "rationale": "Only two mapped water gates are source-backed; legend symbols are not assets.",
            "source_ids": [source_id],
        },
        {
            "id": "review-reading-dry-utilities",
            "subject": "Topographic Survey dry-utility review",
            "status": "reference-derived",
            "value": {
                "approved_count": 2,
                "withheld_geometry": ["OHW", "utility poles", "underground lines", "connectivity"],
            },
            "rationale": "Only two mapped light bollards are source-backed; generic and legend-only utility marks are excluded.",
            "source_ids": [source_id],
        },
    ]


def _build_reading_bundle(
    intake_project: dict[str, Any], source: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    source_id = str(source["id"])
    sanitary_points, sanitary_lines = _sanitary_features(source_id)
    finished_polygons, finished_lines, finished_surfaces = _finished_site_features(source_id)
    points = (
        _grading_points(source_id)
        + sanitary_points
        + _storm_points(source_id)
        + _water_points(source_id)
        + _dry_utility_points(source_id)
    )
    project_identity = copy.deepcopy(intake_project["project"])
    project_identity.update({
        "revision": "reading-reviewed-v4",
        "jurisdiction": "Town of Reading, Massachusetts — source context only",
        "disclaimer": DISCLAIMER,
    })
    project = {
        "schema_version": "civil-plan-factory.project/v0.1.0",
        "project": project_identity,
        "reviewed_source_adapter": {
            "adapter_id": "reading-public-library-reviewed-v4",
            "source_sha256": READING_PLAN_SHA256,
            "status": "complete",
        },
        "artifact_contract": {
            "basename": "reading-public-library-reviewed-model",
            "delivery_mode": "semantic_only_ungeoreferenced",
            "plan_availability": "reviewed_finished_site_model",
            "experience_goal": "Show field employees the recognizable finished job before technical layers are enabled.",
            "base_layer_role": "visual_base",
            "overlay_rule": "Keep Finished Site visible beneath grading and utility layers so every work item remains oriented to the end product.",
            "measurement_contract": {
                "mode": "approximate_plan_measurement",
                "status": "unavailable_until_sheet_scale_calibration",
                "intended_use": "Pre-layout checks such as a sidewalk edge relative to a building corner.",
                "warning": "Verify in field - not for construction staking.",
            },
            "image_url": "",
            "plan_width_ft": 120,
            "plan_height_ft": 80,
            "coordinate_basis": SEMANTIC_REVIEW_GRID_BASIS,
        },
        "spatial_reference": {
            "horizontal_crs": "UNREFERENCED_REVIEW_GRID",
            "horizontal_units": "display_unit",
            "vertical_datum": "SOURCE_PLAN_DATUM_UNVERIFIED",
            "vertical_units": "foot",
            "benchmark": {"status": "unknown", "reason": "No benchmark was established by this reviewed adapter."},
            "transformations": [{
                "from": "source_pdf_y_down_review_grid",
                "to": "canonical_y_up_review_grid",
                "status": "generated_display_transform",
                "formula": "x = source_x; y = plan_height - source_y",
            }],
            "tolerances": {
                "output_parity_display_units": 0.001,
                "source_geometry_accuracy": "uncalibrated sheet-space review location; not field coordinates",
            },
        },
        "source_ledger": "sources.lock.json",
        "decision_ledger": "decisions.json",
        "phases": [{
            "id": "reviewed-source",
            "name": "Reviewed source evidence",
            "summary": "Human-reviewed finished-site geometry and annotations in uncalibrated sheet space.",
        }],
        "layers": [
            {"id": "finished-site", "name": "Finished Site", "color": "#64748b", "defaultVisible": True},
            {"id": "grading", "name": "Grading", "color": "#d97706", "defaultVisible": True},
            {"id": "sanitary", "name": "Sanitary", "color": "#9333ea", "defaultVisible": True},
            {"id": "storm", "name": "Storm", "color": "#0369a1", "defaultVisible": True},
            {"id": "water", "name": "Water", "color": "#2563eb", "defaultVisible": True},
            {"id": "dry-utilities", "name": "Dry Utilities", "color": "#a16207", "defaultVisible": True},
        ],
        "features": {
            "points": points,
            "lines": sanitary_lines + finished_lines,
            "polygons": finished_polygons,
            "surfaces": finished_surfaces,
        },
        "networks": [],
        "deliverables": {"plans": [], "profiles": [], "sections": [], "schedules": [], "detail_cards": []},
        "contract_coverage": _coverage(),
        "limitations": [
            DISCLAIMER,
            "Feature positions are source-sheet review locations and are not calibrated field coordinates.",
            "Elevations preserve source annotations, but their vertical datum was not independently established by this adapter.",
            "Untraced contours, calibrated breaklines/TIN, storm pipes, water mains, OHW, poles, and unsupported systems are explicitly withheld rather than inferred.",
            "Reference-derived reviewed evidence is not survey control, construction staking, permit, bid, or construction authority.",
        ],
    }
    reviewed_source = copy.deepcopy(source)
    reviewed_source.update({
        "authority": "Town of Reading bid drawing set; page-specific evidence reviewed for product-development test use",
        "provenance_status": "reference-derived",
        "supports": ["finished-site", "grading", "sanitary", "storm", "water", "dry-utilities"],
        "review": {
            "adapter_id": "reading-public-library-reviewed-v4",
            "scope": "L1.1 page 5, L2.1 page 6, and Topographic Survey page 2",
            "limitations": "Manual review and native PDF text extraction; uncalibrated sheet-space locations.",
        },
    })
    reviewed_source.pop("unavailable_reason", None)
    sources = {
        "schema_version": "civil-plan-factory.source-ledger/v0.1.0",
        "disclaimer": DISCLAIMER,
        "sources": [reviewed_source],
    }
    decisions = {
        "schema_version": "civil-plan-factory.decision-ledger/v0.1.0",
        "disclaimer": DISCLAIMER,
        "decisions": _decisions(source_id),
    }
    return project, sources, decisions


REVIEWED_SOURCE_ADAPTERS: dict[str, ReviewedSourceAdapter] = {
    READING_PLAN_SHA256: ReviewedSourceAdapter(
        adapter_id="reading-public-library-reviewed-v4",
        title="Reading Public Library recognizable finished site with grading and utility overlays",
        source_sha256=READING_PLAN_SHA256,
        build=_build_reading_bundle,
    ),
}


def adapter_for_checksum(checksum: str) -> ReviewedSourceAdapter | None:
    return REVIEWED_SOURCE_ADAPTERS.get(checksum)
