"""Coordinated vector plan-set renderer for the golden Oregon-style fixture."""

from __future__ import annotations

import base64
import json
import math
from pathlib import Path
from typing import Any, Iterable

from .validation import DISCLAIMER, SAFETY_NOTICE


def declutter_callout_positions(
    anchors: list[tuple[float, float]], minimum_spacing: float = 28.0
) -> list[tuple[float, float]]:
    placed: list[tuple[float, float]] = []
    for anchor_x, anchor_y in anchors:
        selected = None
        for ring in range(0, 20):
            offsets = [(0, 0)] if ring == 0 else [
                (dx, dy)
                for dx in range(-ring, ring + 1)
                for dy in range(-ring, ring + 1)
                if max(abs(dx), abs(dy)) == ring
            ]
            for dx, dy in offsets:
                candidate = (
                    anchor_x + dx * minimum_spacing,
                    anchor_y + dy * minimum_spacing,
                )
                if all(math.dist(candidate, other) >= minimum_spacing for other in placed):
                    selected = candidate
                    break
            if selected:
                break
        if selected is None:
            raise ValueError("Unable to declutter plan callouts")
        placed.append(selected)
    return placed


def _points(value: Any) -> Iterable[list[float]]:
    if (
        isinstance(value, list)
        and len(value) >= 2
        and isinstance(value[0], (int, float))
        and isinstance(value[1], (int, float))
    ):
        yield [float(value[0]), float(value[1])]
    elif isinstance(value, list):
        for item in value:
            yield from _points(item)


def _feature_rows(model: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    return [
        (group, feature)
        for group in ("points", "lines", "polygons", "surfaces")
        for feature in model["features"][group]
    ]


def create_golden_vector_plan(model: dict[str, Any], output_path: Path, digest: str) -> None:
    """Render the declared golden sheet index as one deterministic vector PDF.

    Plan sheets use a true 1 inch = 20 feet paper transform on ARCH D. Full
    callouts live in a dedicated register so map symbols remain readable.
    """

    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.pdfbase.pdfmetrics import stringWidth
    from reportlab.pdfgen import canvas

    plans = model["deliverables"]["plans"]
    rows = _feature_rows(model)
    by_id = {feature["id"]: (group, feature) for group, feature in rows}
    width, height = 36 * inch, 24 * inch
    page_scale = 72.0 / 20.0
    map_left, map_bottom = 86.0, 178.0
    map_width, map_height = 1740.0, 1400.0
    register_left = map_left + map_width + 34.0
    all_points = [point for _, feature in rows for point in _points(feature.get("coordinates", feature.get("boundary")))]
    min_x = min(point[0] for point in all_points)
    max_x = max(point[0] for point in all_points)
    min_y = min(point[1] for point in all_points)
    max_y = max(point[1] for point in all_points)
    origin_x = min_x - (map_width / page_scale - (max_x - min_x)) / 2.0
    origin_y = min_y - (map_height / page_scale - (max_y - min_y)) / 2.0

    def xy(point: list[float]) -> tuple[float, float]:
        return (
            map_left + (point[0] - origin_x) * page_scale,
            map_bottom + (point[1] - origin_y) * page_scale,
        )

    def geometry_value(group: str, feature: dict[str, Any]) -> Any:
        return feature["boundary"] if group == "surfaces" else feature["coordinates"]

    def marker(pdf, group: str, feature: dict[str, Any]) -> None:
        geometry_type = {
            "points": "Point",
            "lines": "LineString",
            "polygons": "Polygon",
            "surfaces": "Polygon",
        }[group]
        value = geometry_value(group, feature)
        converted = list(xy(value)) if group == "points" else [list(xy(point)) for point in value]
        payload = base64.b64encode(json.dumps({
            "id": feature["id"],
            "geometry_type": geometry_type,
            "page_coordinates": converted,
            "transform": {
                "left": map_left,
                "bottom": map_bottom,
                "scale": page_scale,
                "min_x": origin_x,
                "min_y": origin_y,
            },
        }, separators=(",", ":")).encode()).decode()
        pdf._code.append(f"%MS_GEOM {payload}")

    phase_colors = {
        "phase-01-existing-control-erosion": colors.HexColor("#475569"),
        "phase-02-clearing-site-prep": colors.HexColor("#b45309"),
        "phase-03-earthwork-rough-grading": colors.HexColor("#92400e"),
        "phase-04-storm": colors.HexColor("#0369a1"),
        "phase-05-sanitary": colors.HexColor("#991b1b"),
        "phase-06-water-dry-utilities": colors.HexColor("#6d28d9"),
        "phase-07-finish-site": colors.HexColor("#166534"),
    }

    def draw_wrapped(pdf, value: str, x: float, y: float, max_width: float, *, size: float = 8.0, leading: float = 11.0, font: str = "Helvetica") -> float:
        words = value.split()
        lines: list[str] = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if current and stringWidth(candidate, font, size) > max_width:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        pdf.setFont(font, size)
        for line in lines:
            pdf.drawString(x, y, line)
            y -= leading
        return y

    def draw_title_block(pdf, plan: dict[str, Any], page_number: int) -> None:
        pdf.setStrokeColor(colors.HexColor("#0f172a"))
        pdf.setLineWidth(1.2)
        pdf.rect(30, 30, width - 60, height - 60, fill=0, stroke=1)
        pdf.line(30, 145, width - 30, 145)
        pdf.setFillColor(colors.HexColor("#991b1b"))
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(48, height - 54, DISCLAIMER)
        pdf.setFillColor(colors.HexColor("#0f172a"))
        pdf.setFont("Helvetica-Bold", 18)
        pdf.drawString(48, height - 82, plan["title"].upper())
        pdf.setFont("Helvetica", 9)
        pdf.drawString(48, height - 101, "HILYARD APARTMENT CIVIL PLAN TEST — GENERIC OREGON-STYLE PRODUCT FIXTURE")
        pdf.setFont("Helvetica-Bold", 32)
        pdf.drawRightString(width - 48, 88, plan["sheet_number"])
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(48, 112, f"SCALE: {plan['written_scale'].upper()}   |   UNITS: FEET   |   CRS: EPSG:6823")
        pdf.drawString(48, 92, f"PHASE: {(plan.get('phase_id') or 'GENERAL / MULTI-PHASE').upper()}")
        pdf.drawRightString(width - 250, 112, f"PAGE {page_number} OF {len(plans)}")
        pdf.drawRightString(width - 250, 92, f"GEOMETRY SHA-256: {digest[:24]}...")
        pdf.setFillColor(colors.HexColor("#991b1b"))
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawCentredString(width / 2, 54, SAFETY_NOTICE)

    def draw_north_and_scale(pdf, plan: dict[str, Any]) -> None:
        pdf.setFillColor(colors.black)
        pdf.setStrokeColor(colors.black)
        pdf.setLineWidth(2)
        x, y = 1745, 1440
        pdf.line(x, y, x, y + 92)
        pdf.line(x, y + 92, x - 10, y + 70)
        pdf.line(x, y + 92, x + 10, y + 70)
        pdf.setFont("Helvetica-Bold", 15)
        pdf.drawCentredString(x, y + 101, "N")
        values = plan["graphic_scale_ft"]
        bar_x, bar_y = 1450, 212
        for left, right in zip(values, values[1:]):
            segment = (right - left) * page_scale
            pdf.setFillColor(colors.black if values.index(left) % 2 == 0 else colors.white)
            pdf.rect(bar_x + left * page_scale, bar_y, segment, 14, fill=1, stroke=1)
            pdf.setFillColor(colors.black)
            pdf.setFont("Helvetica", 8)
            pdf.drawCentredString(bar_x + left * page_scale, bar_y - 13, str(left))
        pdf.drawCentredString(bar_x + values[-1] * page_scale, bar_y - 13, f"{values[-1]} FT")
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawCentredString(bar_x + values[-1] * page_scale / 2, bar_y + 22, f"GRAPHIC SCALE — {plan['written_scale'].upper()}")

    def feature_center(group: str, feature: dict[str, Any]) -> tuple[float, float]:
        points = list(_points(geometry_value(group, feature)))
        return xy([sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points)])

    def draw_feature(pdf, group: str, feature: dict[str, Any], *, emphasized: bool) -> None:
        value = geometry_value(group, feature)
        color = phase_colors.get(feature.get("phase_id"), colors.HexColor("#64748b"))
        feature_type = feature["feature_type"]
        fill_colors = {
            "building": colors.HexColor("#fef3c7"),
            "pavement_area": colors.HexColor("#cbd5e1"),
            "drive_aisle": colors.HexColor("#94a3b8"),
            "parking_stall": colors.white,
            "pedestrian_flatwork": colors.HexColor("#f8fafc"),
            "curb_ramp": colors.HexColor("#fde68a"),
            "landscape_area": colors.HexColor("#bbf7d0"),
        }
        pdf.saveState()
        if emphasized:
            pdf._code.append(f"%MS_STYLE {feature_type} {feature['id']}")
        pdf.setStrokeColor(color if emphasized else colors.HexColor("#cbd5e1"))
        pdf.setFillColor(fill_colors.get(feature_type, colors.white))
        pdf.setLineWidth(2.4 if emphasized else 0.55)
        if emphasized and feature_type == "curb_line":
            pdf.setStrokeColor(colors.HexColor("#0f172a"))
            pdf.setLineWidth(3.4)
        if emphasized and feature_type == "fire_access_route":
            pdf.setStrokeColor(colors.HexColor("#dc2626"))
            pdf.setDash(12, 6)
            pdf.setLineWidth(3.2)
        if group == "points":
            x, y = xy(value)
            pdf.circle(x, y, 6 if emphasized else 2.5, fill=1, stroke=1)
            pdf.restoreState()
            return
        path = pdf.beginPath()
        first_x, first_y = xy(value[0])
        path.moveTo(first_x, first_y)
        for point in value[1:]:
            x, y = xy(point)
            path.lineTo(x, y)
        if group in {"polygons", "surfaces"}:
            path.close()
        pdf.drawPath(
            path,
            fill=1 if emphasized and group == "polygons" and feature_type in fill_colors else 0,
            stroke=1,
        )
        pdf.restoreState()

    def draw_callout_register(pdf, plan: dict[str, Any]) -> None:
        pdf.setFillColor(colors.HexColor("#f8fafc"))
        pdf.setStrokeColor(colors.HexColor("#94a3b8"))
        pdf.rect(register_left, map_bottom, width - register_left - 48, map_height, fill=1, stroke=1)
        pdf.setFillColor(colors.HexColor("#0f172a"))
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(register_left + 18, height - 142, "FIELD CALLOUT REGISTER")
        y = height - 170
        for index, asset_id in enumerate(plan["asset_ids"], 1):
            pdf.setFillColor(colors.HexColor("#0f172a"))
            pdf.setFont("Helvetica-Bold", 9)
            pdf.drawString(register_left + 18, y, f"{index:02d}  {asset_id}")
            y -= 13
            if asset_id in by_id:
                _, feature = by_id[asset_id]
                detail = feature.get("field_detail", {})
                bits = [feature.get("label", "")]
                for key in ("diameter_in", "material", "length_ft", "slope_percent", "rim_elevation_ft", "invert_elevation_ft", "area_sf"):
                    if key in detail:
                        bits.append(f"{key.replace('_', ' ')}: {detail[key]}")
                y = draw_wrapped(pdf, " | ".join(str(bit) for bit in bits if bit), register_left + 36, y, width - register_left - 92, size=7.2, leading=9)
            else:
                y = draw_wrapped(pdf, "Network or schedule reference — see canonical asset table below.", register_left + 36, y, width - register_left - 92, size=7.2, leading=9)
            y -= 9
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(register_left + 18, max(y - 4, 260), "PROVENANCE / LIMITS")
        limit_y = max(y - 22, 242)
        for note in (
            "Canonical semantic geometry is authoritative.",
            "Reference-derived and reviewed assumptions remain explicitly marked.",
            "No survey, permit, capacity, code-compliance, or staking authority.",
            "Unknown values remain unavailable; no field value is silently invented.",
        ):
            limit_y = draw_wrapped(pdf, note, register_left + 18, limit_y, width - register_left - 74, size=7.5, leading=10)

    pdf = canvas.Canvas(str(output_path), pagesize=(width, height), invariant=1, pageCompression=0)
    pdf.setTitle("Hilyard Apartment Civil Plan Test — Golden Plan Package")
    pdf.setAuthor("Civil Plan Factory / Model Studio")
    pdf.setSubject(f"Canonical geometry SHA-256 {digest}")

    for page_number, plan in enumerate(plans, 1):
        draw_title_block(pdf, plan, page_number)
        if page_number == 1:
            for group, feature in rows:
                marker(pdf, group, feature)
            pdf.setFillColor(colors.HexColor("#0f172a"))
            pdf.setFont("Helvetica-Bold", 24)
            pdf.drawString(90, 1475, "GOLDEN PLAN PACKAGE — SHEET INDEX")
            pdf.setFont("Helvetica", 11)
            pdf.drawString(90, 1448, "One coordinated source model, seven construction phases, and one field-application acceptance path.")
            y = 1390
            for sheet in plans:
                pdf.setFont("Helvetica-Bold", 12)
                pdf.drawString(110, y, sheet["sheet_number"])
                pdf.setFont("Helvetica", 11)
                pdf.drawString(190, y, sheet["title"].upper())
                y -= 38
            pdf.setFillColor(colors.HexColor("#f8fafc"))
            pdf.setStrokeColor(colors.HexColor("#475569"))
            pdf.rect(90, 330, 1510, 630, fill=1, stroke=1)
            cover_features = [
                row for row in rows
                if row[1]["id"] == "property-site-boundary"
                or row[1].get("phase_id") == "phase-07-finish-site"
            ]
            for group, feature in cover_features:
                draw_feature(pdf, group, feature, emphasized=True)
            pdf.setFillColor(colors.HexColor("#0f172a"))
            pdf.setFont("Helvetica-Bold", 11)
            pdf.drawString(90, 292, "COORDINATE BASIS: EPSG:6823 / FEET — REFERENCE-SCALE PRODUCT QA ONLY")
            pdf.drawString(90, 270, "KNOWN REFERENCE DISTANCES AND CALIBRATION CHECKS ARE WITHHELD FROM APP IMPORT AND VERIFIED SEPARATELY.")
            pdf.drawString(90, 248, "COVER REFERENCE: " + " | ".join(plan["asset_ids"]))
            artifact = model.get("artifact_contract", {})
            origin = artifact.get("drawing_origin", [origin_x, origin_y])
            pdf.drawString(90, 226, f"DRAWING GRID ORIGIN: E {origin[0]:.2f} / N {origin[1]:.2f}")
            pdf.drawString(90, 204, artifact.get("primary_access_label", "E 34TH AVENUE - ACCESS BASIS"))
            pdf.drawString(640, 204, artifact.get("secondary_frontage_label", "HILYARD STREET - NO DRIVEWAY"))
        elif plan["sheet_number"] == "C8.00":
            draw_callout_register(pdf, plan)
            pdf.setFillColor(colors.HexColor("#0f172a"))
            pdf.setFont("Helvetica-Bold", 15)
            pdf.drawString(map_left, height - 145, "CIVIL SECTIONS AND CANONICAL NETWORK SCHEDULE")
            y = height - 180
            for section in model["deliverables"].get("sections", []):
                pdf.setFont("Helvetica-Bold", 10)
                pdf.drawString(map_left, y, f"{section['id']} — {section['title'].upper()}")
                y -= 22
            y -= 8
            for network in model["networks"]:
                pdf.setFont("Helvetica-Bold", 10)
                pdf.drawString(map_left, y, f"{network['id']} / {network['system'].upper()}")
                y -= 17
                for edge in network.get("edges", []):
                    detail = edge.get("field_detail", {})
                    line = f"{edge['id']}  {edge['from_node_id']} -> {edge['to_node_id']}"
                    if detail:
                        line += "  " + " | ".join(f"{key}={value}" for key, value in list(detail.items())[:5])
                    y = draw_wrapped(pdf, line, map_left + 22, y, map_width - 40, size=7.2, leading=9)
                    if y < 230:
                        break
                if y < 230:
                    break
        else:
            selected_phase = plan.get("phase_id")
            context_ids = {"property-site-boundary", "building-apartment-1"}
            for group, feature in rows:
                emphasized = feature.get("phase_id") == selected_phase or feature["id"] in plan["asset_ids"]
                if emphasized or feature["id"] in context_ids:
                    draw_feature(pdf, group, feature, emphasized=emphasized)
            callout_assets = [asset_id for asset_id in plan["asset_ids"] if asset_id in by_id]
            anchors = [feature_center(*by_id[asset_id]) for asset_id in callout_assets]
            callout_positions = declutter_callout_positions(anchors)
            for index, (asset_id, anchor, position) in enumerate(
                zip(callout_assets, anchors, callout_positions), 1
            ):
                x, y = position
                if position != anchor:
                    pdf.setStrokeColor(colors.HexColor("#64748b"))
                    pdf.setLineWidth(0.8)
                    pdf.line(anchor[0], anchor[1], x, y)
                pdf.setFillColor(colors.white)
                pdf.setStrokeColor(colors.HexColor("#0f172a"))
                pdf.circle(x, y, 11, fill=1, stroke=1)
                pdf.setFillColor(colors.HexColor("#0f172a"))
                pdf.setFont("Helvetica-Bold", 8)
                pdf.drawCentredString(x, y - 3, str(index))
            draw_callout_register(pdf, plan)
            draw_north_and_scale(pdf, plan)
        pdf.showPage()

    pdf.save()
