# Eugene Hilyard Civil Plan Factory — Research Brief

Status: fictional test-data project; not for construction, permitting, bidding, or field layout.

## Selected site

The study area is the City-owned Hilyard Street property between East 33rd and East 34th Avenue in Eugene, Oregon. It comprises four taxlots totaling approximately 0.9485 acre. About 0.76 acre remains after the anticipated east-side right-of-way dedication.

[Open the site in Google Maps](https://www.google.com/maps/search/?api=1&query=44.020407%2C-123.082004)

Confirmed site facts from official sources:

- Vacant, relatively flat grass site with public streets on three sides.
- Vehicle access should come from East 34th Avenue; the public site basis prohibits a Hilyard driveway.
- A 30-foot west and 15-foot south EWEB easement contains or is planned for water, electric conduit, and fiber infrastructure.
- A 12-foot sanitary easement crosses the site east-west; no building should be placed over it.
- City GIS identifies an 8-inch sanitary line crossing the site and a 21-inch storm line near the east side.
- A site-specific delineation identifies approximately 0.13 acre of wetland.
- Soil is hydric, poorly drained, high-clay material; public terrain data shows a very flat site near elevation 444 feet NAVD88.
- Exact capacity and approved connection points remain unconfirmed. Gas-main and non-EWEB telecom locations remain explicit assumptions.

Primary site source: [City 2026 RFP appendix](https://www.eugene-or.gov/DocumentCenter/View/81457/Appendix-A-2026-AHTF-RFP-Land-info-34th-Hilyard)

## Conservative fictional concept

- One compact three-story apartment bar, approximately 45 by 90–100 feet, on the southeast/east-central portion.
- Twelve to eighteen fictional units, used only to derive site utility demand and civil geometry.
- One driveway from East 34th Avenue into a compact parking/service court.
- Preserve the delineated wetland and western EWEB corridor as open space and utility area.
- Keep the building clear of the sanitary easement.
- Use a lined stormwater treatment/detention planter with underdrain because infiltration is unproven and likely poor.
- Route domestic/fire water and EWEB dry utilities through the established utility corridor.
- Tie sanitary and storm systems to the confirmed nearby networks only as clearly labeled test assumptions pending capacity and approval.

## Plan-factory platform

Primary workflow: Git-versioned Python plus QGIS.

- Python/YAML is the canonical engineering model and decision ledger.
- GeoPackage stores attributed, named spatial layers.
- QGIS provides CRS-aware terrain processing, TIN/contours, visual review, labels, sheet templates, atlas generation, and layered vector GeoPDF export.
- DXF is generated as a CAD interchange copy; BricsCAD on Mac is the optional paid manual-polish fallback.
- Civil 3D is not the primary workflow because it requires Windows and Autodesk Education licensing cannot be assumed for product-development use.

Canonical project CRS: EPSG:6823, NAD83(2011) / Oregon Eugene zone, international feet. City GIS sources arrive in EPSG:2914 and are reprojected once at ingestion. Vertical datum is NAVD88 feet; any fictional benchmark must be labeled assumed until surveyed.

## Initial sheet categories — reference only

The following eight categories are a useful starting reference, **not a sufficient
scope or fixed sheet count**:

1. Cover, index, basis, legend, and fictional-data disclaimer
2. Existing conditions and demolition
3. Site and horizontal control
4. Grading and drainage
5. Composite utilities and building stub-outs
6. Sanitary and storm profiles
7. Erosion and sediment control
8. Trenches, pavement, curb, structures, and representative cross-sections

The final sheet list and count must be derived from the complete Excavation Field
Map model contract. If separate utility plans, additional profiles, grading
details, control plans, schedules, or object-detail sheets are needed to carry
the full model without crowding or ambiguity, the generator must create them.
The plan factory should export a layered vector PDF/GeoPDF, GeoPackage, DXF,
machine-readable semantic model manifest, and validation report. Every sheet
must say **FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION**.

## Required engineering systems

- Existing and proposed terrain, contours, spot grades, pad, pavement, curb, walks, and limits of disturbance
- Domestic water and separate fire service
- Sanitary main/service, manholes, cleanouts, inverts, slopes, and profile
- Storm structures, roof leaders, treatment/detention, overflow/outfall, inverts, slopes, and profile
- Gas, electric, fiber, and telecom routes with explicit assumed tie-ins where records are unavailable
- Erosion control, wetland protection, stabilized entrance, inlet protection, stockpile and washout areas
- Building penetrations and external utility stub-outs only; no interior MEP design

## Acceptance bar

The project is not complete when the PDF merely looks authentic, nor when a
fixed minimum number of sheets exists. It passes when:

- Every system is generated from one coordinate/elevation model rather than redrawn per sheet.
- Plan, profile, section, schedule, and labels share identical asset IDs and engineering values.
- Gravity networks flow downhill and cover, separation, crossings, and structures validate against the cited constraints file.
- Proposed contours derive from the proposed surface, and cut/fill derives from existing versus proposed surfaces.
- The vector PDF retains extractable paths, text, named layer groups, scale, and control coordinates.
- Excavation Field Map can hide the PDF, redraw the **complete object model**,
  preserve scale, toggle systems independently, search and select every required
  object, show its field details, and match the canonical GeoPackage within
  tolerance.

## Next build step

First freeze the Excavation Field Map model contract: required layers, geometry
types, asset relationships, excavation attributes, field-detail fields,
calibration/control data, and interaction acceptance tests. Then create the
plan-factory repository foundation—project schema, decisions ledger, source
lock file, EPSG:6823 transformations, frozen site basis, and failing validation
tests—and generate as many coordinated sheets as the complete model requires.

Detailed numeric rules are saved in `eugene_hilyard_design_constraints.yaml` beside this brief.
