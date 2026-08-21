# Model Studio

Model Studio is the single operator-facing entry point for building reusable,
semantic civil-job test data. This repository is a product-development tool,
not a professional engineering service. Every generated artifact must state:

> FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION

The authoritative product is a versioned civil job model: coordinates, control,
surfaces, limits, wet and dry utility topology, structures, building/pads,
grading, flatwork, ADA, construction/erosion controls, materials, provenance,
field details, workflows, checklists, and relationships. Plans, profiles,
sections, schedules, detail cards, layered vector GeoPDF, GeoPackage, DXF, and
the Excavation Field Map adapter will derive from that model. Sheet count is a
readability outcome, never a fixed acceptance target.

## Foundation commands

No third-party runtime packages are required for this slice.

```bash
PYTHONPATH=src python3 -m unittest discover -s tests -v
PYTHONPATH=src python3 -m civil_plan_factory doctor
PYTHONPATH=src python3 -m civil_plan_factory validate \
  projects/hilyard/project.json \
  --output-dir outputs/hilyard-foundation
```

For the installed command:

```bash
python3 -m pip install -e .
model-studio doctor
model-studio validate projects/hilyard/project.json --output-dir outputs/hilyard-foundation
```

The current `validate` command emits only a deterministic semantic skeleton and
validation report. Empty collections are intentional and paired with explicit
unavailable reasons. It does not create final civil plans or imply that a design
exists.

## Repository layout

- `projects/hilyard/` — frozen project, source lock, and decision ledger
- `schemas/v0.1.0/` — versioned project, canonical geometry/network, ledger, and app-adapter contracts
- `src/civil_plan_factory/` — Model Studio loader, validators, exporter, and CLI
- `tests/` — behavior and integration tests
- `outputs/` — small deterministic review artifacts only

The Excavation Field Map repository at
`/Users/richardholguin/Projects/excavation-field-map` is a read-only consumer
reference for this project.

## Roadmap and required engineering order

The next implementation slice begins only after this foundation is committed:

1. Freeze the selected **Hilyard Street** four-taxlot boundary plus known ROW,
   sanitary/EWEB easements, wetland, and resource constraints with coordinates
   and provenance.
2. Add a human-reviewed-assumption fictional apartment footprint and complete
   2D building/pad object inside the usable area, proving clearance from every
   frozen constraint.
3. Build one full utility at a time, starting with sanitary. Before routing,
   establish the minimum vertical envelope: reference existing surface,
   reviewed-assumption finished-floor elevation, available public main/manhole
   geometry and inverts, an explicitly assumed connection point, cited cover and
   slope rules, and validation. Then derive sanitary nodes, edges, structures,
   laterals, elevations, slopes, materials, cover, topology, provenance, and
   field details.
4. From the same passing canonical run, generate a vector PDF plan, GeoPackage,
   and Excavation Field Map package and reconcile them by asset ID and geometry.
5. Add grading/site preparation, proposed contours, and cut/fill later. Sanitary
   cannot be called valid without its supporting elevation/cover envelope.
6. Sequence remaining systems by dependency and conflict risk, not convenience.

## Planned closed-loop proof

Model Studio will eventually provide one workflow to create/open a project,
ingest plans, extract geometry and rules, review uncertainty, validate, generate
coordinated plans and semantic packages, and publish to Excavation Field Map.
The proof loop is:

1. create the reviewed Hilyard canonical model;
2. generate vector plans strictly from its values;
3. ingest those generated plans through the extraction path;
4. rebuild a second semantic model;
5. compare coordinates, topology, elevations, materials, and object details to
   the canonical model; and
6. require human review before uncertain fields can be accepted or published.

Automation percentages will not be claimed until this loop produces measured,
repeatable results.
