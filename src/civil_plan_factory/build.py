"""Deterministic Model Studio artifact generation from one canonical model."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from typing import Any

from .export import build_semantic_manifest
from .validation import DISCLAIMER, validate_model


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def geometry_digest(model: dict[str, Any]) -> str:
    geometry = [
        {"id": feature["id"], "geometry_type": group, "coordinates": feature.get("coordinates") or feature.get("boundary")}
        for group in ("points", "lines", "polygons", "surfaces")
        for feature in model["features"][group]
    ]
    encoded = json.dumps(geometry, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def _geojson_collection(features: list[dict[str, Any]], geometry_type: str) -> dict[str, Any]:
    rows = []
    for feature in features:
        properties = {
            "id": feature["id"],
            "feature_type": feature["feature_type"],
            "label": feature["label"],
            "layer_id": feature["layer_id"],
            "phase_id": feature["phase_id"],
            "system": feature.get("system"),
            "provenance_status": feature["provenance"]["status"],
            "source_ids": json.dumps(feature["provenance"].get("source_ids", []), separators=(",", ":")),
            "decision_ids": json.dumps(feature["provenance"].get("decision_ids", []), separators=(",", ":")),
            "field_detail": json.dumps(feature.get("field_detail", {}), sort_keys=True, separators=(",", ":")),
        }
        coordinates = [feature["coordinates"]] if geometry_type == "Polygon" else feature["coordinates"]
        rows.append({
            "type": "Feature",
            "geometry": {"type": geometry_type, "coordinates": coordinates},
            "properties": properties,
        })
    return {
        "type": "FeatureCollection",
        "name": f"canonical_{geometry_type.lower()}",
        "crs": {"type": "name", "properties": {"name": "EPSG:6823"}},
        "features": rows,
    }


def create_geopackage(model: dict[str, Any], output_path: Path, qgis_app: Path) -> None:
    ogr2ogr = qgis_app / "Contents" / "MacOS" / "ogr2ogr"
    proj_data = qgis_app / "Contents" / "Resources" / "qgis" / "proj"
    env = os.environ.copy()
    env["PROJ_DATA"] = str(proj_data)
    env["PROJ_LIB"] = str(proj_data)
    layers = (
        ("points", "Point", "canonical_points"),
        ("lines", "LineString", "canonical_lines"),
        ("polygons", "Polygon", "canonical_polygons"),
    )
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        for index, (group, geometry_type, layer_name) in enumerate(layers):
            source = temp / f"{layer_name}.geojson"
            _write_json(source, _geojson_collection(model["features"][group], geometry_type))
            command = [
                str(ogr2ogr), "-f", "GPKG", str(output_path), str(source),
                "-nln", layer_name, "-a_srs", "EPSG:6823",
            ]
            if index:
                command.extend(["-append"])
            result = subprocess.run(command, env=env, text=True, capture_output=True)
            if result.returncode:
                raise RuntimeError(f"ogr2ogr failed for {layer_name}: {result.stderr.strip()}")


def _centroid(ring: list[list[float]]) -> tuple[float, float]:
    points = ring[:-1]
    return sum(point[0] for point in points) / len(points), sum(point[1] for point in points) / len(points)


def create_vector_plan(model: dict[str, Any], output_path: Path, digest: str) -> None:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.pdfgen import canvas
    from pypdf import PdfReader, PdfWriter

    width, height = landscape(letter)
    drawing_left = 42.0
    drawing_bottom = 72.0
    scale = 72.0 / 50.0
    min_x = 186225.0
    min_y = 98450.0

    def xy(point: list[float]) -> tuple[float, float]:
        return drawing_left + (point[0] - min_x) * scale, drawing_bottom + (point[1] - min_y) * scale

    def path_ring(pdf, ring, *, fill=0, stroke=1):
        path = pdf.beginPath()
        x, y = xy(ring[0])
        path.moveTo(x, y)
        for point in ring[1:]:
            x, y = xy(point)
            path.lineTo(x, y)
        path.close()
        pdf.drawPath(path, fill=fill, stroke=stroke)

    raw_path = output_path.with_suffix(".raw.pdf")
    pdf = canvas.Canvas(str(raw_path), pagesize=(width, height), invariant=1, pageCompression=0)
    pdf.setTitle("Model Studio - Hilyard Site Layout")
    pdf.setAuthor("Model Studio")
    pdf.setSubject(f"Canonical geometry SHA-256 {digest}")

    pdf.setFillColor(colors.HexColor("#991b1b"))
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(32, height - 27, DISCLAIMER)
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(32, height - 49, "MODEL STUDIO - HILYARD SITE LAYOUT / BUILDING INTERFACES")
    pdf.setFont("Helvetica", 7)
    pdf.drawString(32, height - 61, "Product-development test data only - no survey, engineering, capacity, approval, or code-compliance claim")

    polygon_by_id = {feature["id"]: feature for feature in model["features"]["polygons"]}
    taxlots = [feature for feature in model["features"]["polygons"] if feature["feature_type"] == "taxlot"]
    constraints = [feature for feature in model["features"]["polygons"] if feature["id"].startswith("constraint-")]

    constraint_colors = {
        "constraint-row-dedication": colors.HexColor("#fca5a5"),
        "constraint-eweb-west": colors.HexColor("#fed7aa"),
        "constraint-eweb-south": colors.HexColor("#fed7aa"),
        "constraint-sanitary-easement": colors.HexColor("#d8b4fe"),
        "constraint-wetland": colors.HexColor("#93c5fd"),
    }
    for feature in constraints:
        pdf.saveState()
        pdf.setFillColor(constraint_colors[feature["id"]])
        pdf.setStrokeColor(colors.HexColor("#475569"))
        pdf.setLineWidth(0.8)
        path_ring(pdf, feature["coordinates"], fill=1)
        pdf.restoreState()

    pdf.setFillColor(colors.white)
    pdf.setStrokeColor(colors.HexColor("#94a3b8"))
    pdf.setLineWidth(0.55)
    for feature in taxlots:
        path_ring(pdf, feature["coordinates"], fill=0)
        cx, cy = xy(list(_centroid(feature["coordinates"])))
        pdf.setFillColor(colors.HexColor("#475569"))
        pdf.setFont("Helvetica", 6.5)
        pdf.drawCentredString(cx, cy, feature["id"])

    site = polygon_by_id["property-site-boundary"]
    pdf.setStrokeColor(colors.HexColor("#0f172a"))
    pdf.setLineWidth(1.8)
    path_ring(pdf, site["coordinates"], fill=0)

    pad = polygon_by_id["pad-apartment-1"]
    pdf.setFillColor(colors.HexColor("#d1d5db"))
    pdf.setStrokeColor(colors.HexColor("#4b5563"))
    pdf.setLineWidth(1.0)
    path_ring(pdf, pad["coordinates"], fill=1)
    building = polygon_by_id["building-apartment-1"]
    pdf.setFillColor(colors.HexColor("#f8fafc"))
    pdf.setStrokeColor(colors.HexColor("#111827"))
    pdf.setLineWidth(2.0)
    path_ring(pdf, building["coordinates"], fill=1)
    cx, cy = xy(list(_centroid(building["coordinates"])))
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica-Bold", 4.8)
    pdf.drawCentredString(cx, cy + 5, "building-apartment-1")
    pdf.setFont("Helvetica", 5.5)
    pdf.drawCentredString(cx, cy - 5, "45 FT x 90 FT / FFE UNKNOWN")

    for line in model["features"]["lines"]:
        pdf.setStrokeColor(colors.HexColor("#be123c") if line["id"].startswith("access-") else colors.HexColor("#334155"))
        pdf.setLineWidth(2.2 if line["id"].startswith("access-") else 1.2)
        path = pdf.beginPath()
        x, y = xy(line["coordinates"][0])
        path.moveTo(x, y)
        for point in line["coordinates"][1:]:
            x, y = xy(point)
            path.lineTo(x, y)
        pdf.drawPath(path, fill=0, stroke=1)

    pdf.setFillColor(colors.HexColor("#9f1239"))
    pdf.setFont("Helvetica-Bold", 6.5)
    pdf.drawCentredString(220, 78, "E 34TH AVENUE - ACCESS BASIS")
    pdf.saveState()
    pdf.translate(324, 190)
    pdf.rotate(90)
    pdf.drawCentredString(0, 0, "HILYARD STREET - NO DRIVEWAY")
    pdf.restoreState()

    points = model["features"]["points"]
    for index, feature in enumerate(points, 1):
        x, y = xy(feature["coordinates"])
        pdf.setFillColor(colors.HexColor("#0f766e") if feature["feature_type"] == "building_entry" else colors.HexColor("#dc2626"))
        pdf.circle(x, y, 3.0, fill=1, stroke=0)
        pdf.setFillColor(colors.black)
        pdf.setFont("Helvetica-Bold", 5.5)
        pdf.drawString(x + 4, y + 2, str(index))

    # North arrow and scale/control basis.
    pdf.setStrokeColor(colors.black)
    pdf.setFillColor(colors.black)
    pdf.setLineWidth(1.2)
    pdf.line(350, 470, 350, 515)
    pdf.line(350, 515, 344, 503)
    pdf.line(350, 515, 356, 503)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(350, 522, "N")
    scale_x, scale_y = 313, 445
    pdf.rect(scale_x, scale_y, 36, 7, fill=1, stroke=1)
    pdf.setFillColor(colors.white)
    pdf.rect(scale_x + 36, scale_y, 36, 7, fill=1, stroke=1)
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica", 6)
    pdf.drawString(scale_x, scale_y - 9, "0")
    pdf.drawCentredString(scale_x + 36, scale_y - 9, "25")
    pdf.drawRightString(scale_x + 72, scale_y - 9, "50 FT")
    pdf.drawCentredString(scale_x + 36, scale_y - 19, "GRAPHIC SCALE / 1 IN = 50 FT")

    notes_x = 390
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(notes_x, 520, "BASIS / CONTROL")
    pdf.setFont("Helvetica", 7)
    basis = [
        "Horizontal: EPSG:6823, international feet",
        "DRAWING GRID ORIGIN: E 186225.00 / N 98450.00",
        "Vertical: NAVD88 feet; benchmark and elevations UNKNOWN",
        "Taxlots: City GIS reference-derived; NOT A SURVEY",
        "Replace taxlot geometry first when a boundary survey arrives",
        "Constraints: dimensioned/digitized reference geometry",
        "Output parity tolerance: 0.01 ft (not source accuracy)",
        "No final grading, FFE, utility routing, or capacity in this slice",
    ]
    for offset, note in enumerate(basis):
        pdf.drawString(notes_x, 506 - offset * 11, note)

    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(notes_x, 418, "BUILDING INTERFACES - PERMANENT TERMINAL IDS")
    pdf.setFont("Helvetica", 6.4)
    for index, feature in enumerate(points, 1):
        value = f"{index:02d}  {feature['id']}  [{feature.get('system', '-')}]"
        pdf.drawString(notes_x, 405 - (index - 1) * 11, value)

    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(notes_x, 270, "CONSTRAINT LEGEND")
    pdf.setFont("Helvetica", 6.5)
    for offset, feature in enumerate(constraints):
        pdf.setFillColor(constraint_colors[feature["id"]])
        pdf.rect(notes_x, 254 - offset * 15, 12, 8, fill=1, stroke=1)
        pdf.setFillColor(colors.black)
        pdf.drawString(notes_x + 17, 255 - offset * 15, feature["id"])

    pdf.setFillColor(colors.HexColor("#991b1b"))
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, 31, DISCLAIMER)
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica", 6)
    pdf.drawString(32, 17, "Sheet MS-01 | Hilyard Street, Eugene, Oregon | Semantic site-layout test | Page 1 of 1")
    pdf.drawRightString(width - 32, 17, f"Geometry SHA-256: {digest[:20]}...")
    pdf.showPage()
    pdf.save()

    reader = PdfReader(raw_path)
    writer = PdfWriter(clone_from=reader)
    writer.add_metadata({
        "/Title": "Model Studio - Hilyard Site Layout",
        "/ModelStudioGeometrySHA256": digest,
        "/ModelStudioDisclaimer": DISCLAIMER,
    })
    with output_path.open("wb") as stream:
        writer.write(stream)
    raw_path.unlink()


def _flatten_coordinates(value: Any) -> list[float]:
    if isinstance(value, list) and value and isinstance(value[0], (int, float)):
        return [float(item) for item in value]
    result: list[float] = []
    for item in value or []:
        result.extend(_flatten_coordinates(item))
    return result


def _max_coordinate_delta(expected: Any, actual: Any) -> float:
    left = _flatten_coordinates(expected)
    right = _flatten_coordinates(actual)
    if len(left) != len(right):
        return float("inf")
    return max((abs(a - b) for a, b in zip(left, right)), default=0.0)


def verify_parity(
    model: dict[str, Any], semantic: dict[str, Any], pdf_path: Path,
    gpkg_path: Path, qgis_app: Path,
) -> dict[str, Any]:
    from pypdf import PdfReader

    tolerance = float(model["spatial_reference"]["tolerances"]["output_parity_horizontal_ft"])
    canonical = {
        feature["id"]: feature["coordinates"]
        for group in ("points", "lines", "polygons")
        for feature in model["features"][group]
    }
    semantic_geometry = {
        row["id"]: [row["x"], row["y"]] for row in semantic["objects"]
    }
    semantic_geometry.update({row["id"]: row["coordinates"] for row in semantic["linearFeatures"] + semantic["areas"]})
    mismatches: list[dict[str, Any]] = []
    for feature_id, coordinates in canonical.items():
        if feature_id not in semantic_geometry:
            mismatches.append({"artifact": "semantic", "id": feature_id, "reason": "missing"})
        elif _max_coordinate_delta(coordinates, semantic_geometry[feature_id]) > tolerance:
            mismatches.append({"artifact": "semantic", "id": feature_id, "reason": "geometry_delta"})

    ogrinfo = qgis_app / "Contents" / "MacOS" / "ogrinfo"
    proj_data = qgis_app / "Contents" / "Resources" / "qgis" / "proj"
    env = os.environ.copy()
    env["PROJ_DATA"] = str(proj_data)
    env["PROJ_LIB"] = str(proj_data)
    gpkg_ids: set[str] = set()
    for layer in ("canonical_points", "canonical_lines", "canonical_polygons"):
        result = subprocess.run([str(ogrinfo), "-json", "-features", str(gpkg_path), layer], env=env, text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError(f"ogrinfo failed for {layer}: {result.stderr.strip()}")
        collection = json.loads(result.stdout)
        for row in collection["layers"][0]["features"]:
            feature_id = row["properties"]["id"]
            gpkg_ids.add(feature_id)
            coordinates = row["geometry"]["coordinates"]
            if layer == "canonical_polygons":
                coordinates = coordinates[0]
            if _max_coordinate_delta(canonical[feature_id], coordinates) > tolerance:
                mismatches.append({"artifact": "geopackage", "id": feature_id, "reason": "geometry_delta"})
    for feature_id in set(canonical) - gpkg_ids:
        mismatches.append({"artifact": "geopackage", "id": feature_id, "reason": "missing"})

    reader = PdfReader(pdf_path)
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    content = b"\n".join(page.get_contents().get_data() for page in reader.pages)
    vector_paths = bool(re.search(rb"\b(?:m|l|re)\b", content))
    image_count = 0
    for page in reader.pages:
        for obj in page.get("/Resources", {}).get("/XObject", {}).values():
            if obj.get_object().get("/Subtype") == "/Image":
                image_count += 1
    pdf_digest = reader.metadata.get("/ModelStudioGeometrySHA256")
    digest = geometry_digest(model)
    if pdf_digest != digest:
        mismatches.append({"artifact": "pdf", "reason": "geometry_digest"})
    if not vector_paths or image_count:
        mismatches.append({"artifact": "pdf", "reason": "not_vector_only"})
    for feature_id in ("building-apartment-1", "constraint-wetland", "penetration-sanitary"):
        if feature_id not in text:
            mismatches.append({"artifact": "pdf", "id": feature_id, "reason": "text_not_extractable"})

    return {
        "schema_version": "civil-plan-factory.parity-report/v0.1.0",
        "disclaimer": DISCLAIMER,
        "status": "invalid" if mismatches else "valid",
        "horizontal_tolerance_ft": tolerance,
        "tolerance_note": "Output-to-output numeric equality tolerance; not survey/source accuracy.",
        "canonical_geometry_sha256": digest,
        "feature_count": len(canonical),
        "semantic": {"feature_count": len(semantic_geometry)},
        "geopackage": {"feature_count": len(gpkg_ids), "layers": ["canonical_points", "canonical_lines", "canonical_polygons"]},
        "pdf": {"geometry_sha256": pdf_digest, "vector_paths_present": vector_paths, "embedded_image_count": image_count, "text_extractable": DISCLAIMER in text},
        "mismatches": mismatches,
    }


def build_project(model: dict[str, Any], output_dir: Path, qgis_app: Path) -> int:
    issues = validate_model(model)
    errors = [issue for issue in issues if issue.severity == "error"]
    output_dir.mkdir(parents=True, exist_ok=True)
    validation_report = {
        "schema_version": "civil-plan-factory.validation-report/v0.2.0",
        "project_id": model["project"]["id"],
        "disclaimer": DISCLAIMER,
        "status": "invalid" if errors else "valid",
        "issues": [issue.to_dict() for issue in issues],
        "limitations": model.get("limitations", []),
    }
    _write_json(output_dir / "validation-report.json", validation_report)
    if errors:
        return 1

    semantic = build_semantic_manifest(model)
    semantic_path = output_dir / "semantic-manifest.json"
    gpkg_path = output_dir / "hilyard-site-layout.gpkg"
    pdf_path = output_dir / "hilyard-site-layout.pdf"
    _write_json(semantic_path, semantic)
    create_geopackage(model, gpkg_path, qgis_app)
    digest = geometry_digest(model)
    create_vector_plan(model, pdf_path, digest)
    parity = verify_parity(model, semantic, pdf_path, gpkg_path, qgis_app)
    _write_json(output_dir / "parity-report.json", parity)
    return 0 if parity["status"] == "valid" else 1
