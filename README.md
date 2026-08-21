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

## Reproducible commands

```bash
python3 -m venv work/venv
work/venv/bin/python -m pip install -e .
PYTHONPATH=src work/venv/bin/python -m unittest discover -s tests -v
PYTHONPATH=src work/venv/bin/python -m civil_plan_factory doctor
PYTHONPATH=src work/venv/bin/python -m civil_plan_factory validate \
  projects/hilyard/project.json \
  --output-dir outputs/hilyard-foundation
```

For the installed command:

```bash
python3 -m pip install -e .
model-studio doctor
model-studio validate projects/hilyard/project.json --output-dir outputs/hilyard-foundation
```

## Local production console

The operator-facing console runs locally and delegates all civil-model work to
the canonical loader, validator, and builder in this package:

```bash
model-studio serve --repository "$PWD"
```

Open `http://127.0.0.1:8777`. The console provides one fail-closed workflow:

1. select an existing project or create an explicitly incomplete intake draft;
2. add PDF plan sets, which are copied into the project intake folder and
   SHA-256 locked with `unknown` provenance and no supported model claims;
3. run the canonical validation/build/parity pipeline and watch its current
   stage;
4. review active issues and record recovery notes without clearing or
   downgrading the validator gate;
5. inspect limitations, provenance counts, artifacts, and publication
   readiness; and
6. publish a passing run to a content-addressed immutable handoff under
   `.model-studio/published/<project>/<sha256>/`.

For normal macOS use without a terminal, install the one-click launcher once:

```bash
scripts/install-model-studio-app.sh
```

Then open **Model Studio** from `~/Applications` or its Desktop shortcut. The
app reuses a healthy supervised service, otherwise starts the single committed
pm2 process, waits for `/api/health`, and opens the console. See
[`docs/macos-launcher.md`](docs/macos-launcher.md) for operation and recovery.

The handoff directory contains `semantic-manifest.json`, the validation and
parity evidence, the coordinated generated artifacts, and
`handoff-manifest.json` with checksums and the exact import seam. The current
Field Map consumer uses local file import: choose the published
`semantic-manifest.json` in its model-package file input. Remote delivery is
reported as `not_configured`; the console does not fabricate a remote endpoint
or credentials.

The workflow is now exercised against an independent public Phoenix plan-set
intake (which correctly remains blocked), a third Park Drive intake, and the
publishable controlled commercial `cascade-commerce` fixture. See
[`docs/model-studio-repeatability.md`](docs/model-studio-repeatability.md) for
source checksums, timings, manual interventions, blockers, and the read-only
Field Map contract result.

Console run state and publications live under `.model-studio/` and are ignored
by git. For persistent unattended use, run the command under a local process
supervisor such as pm2. A foreground launch is appropriate for an operator
session and exits cleanly with Ctrl-C.

The `validate` command emits a deterministic semantic package and validation
report. The current coordinated site/sanitary/storm/water-fire/dry-utilities/grading
slice is generated with:

```bash
model-studio build projects/hilyard/project.json \
  --output-dir outputs/hilyard-grading-site-prep
```

This produces a twelve-page, vector-only PDF (composite context; sanitary plan
and profile; storm/roof plan, profile, and schedule/test details; and
water/fire plan plus separation/test details; dry-utility/joint-trench plan and
coordination schedule; grading/drainage plan; and earthwork/site-preparation
plan), a true-geometry GeoPackage, the
semantic Excavation Field Map package, and
validation/parity reports from one canonical model. The parity report decodes
geometry markers from the actual PDF content stream and compares them with
geometry read back from the GeoPackage, including canonical surface polygons.

The sanitary service is a known-answer fictional design: two 6-inch PVC SDR35
segments at 1.00% connect the permanent building terminal through a two-way
cleanout to an explicitly assumed connection on City GIS public main
`UNIQUE_ID 4589`. City GIS alignment, rims, and inverts are reference-derived;
the building FFE, extrapolated surface, service inverts, and tie are reviewed
assumptions. Project survey, final grading, capacity, tie-in approval, and
utility-owner acceptance remain unresolved.

The storm slice connects two reviewed-assumption roof leaders through the
permanent roof-drainage terminal to a lined 400-square-foot planter, flow
control, external-drop site manhole, and an assumed connection at City GIS
storm main `UNIQUE_ID 4183`. The 4,050-square-foot roof uses a conservative
runoff coefficient of 1.00. The 1.4-inch water-quality volume is 472.50 cubic
feet; the unrouted 4.46-inch 10-year roof-volume screen is 1,505.25 cubic feet.
The planter's declared 500-cubic-foot surface storage passes only the simple
water-quality volume screen. No routed hydrograph, capacity/HGL, infiltration
credit, approved outfall, final grading, survey authority, or permit-compliance
claim is made. Water and fire remain outside that storm design basis.

The coordinated water/fire slice uses the active 8-inch cast-iron East 34th
Avenue EWEB main from current GIS as reference context. A reviewed-assumption
2-inch HDPE DR11 domestic service connects through a master meter and RPBA to
the permanent domestic terminal. A separate reviewed-assumption 6-inch C900
DR18 fire service connects through an isolation valve and detector double-check
assembly to the permanent fire terminal, with a 4-inch FDC branch. Exact points
of connection, available pressure, flow, capacity, hydrant-test results,
hydraulic adequacy, device selections, tie approval, and agency/Fire Marshal
acceptance remain explicitly unknown.

The dry-utility slice keeps confirmed utility ownership separate from fictional
routing. EWEB is the source-backed electric owner and NW Natural the
source-backed gas utility; the telecom provider at this parcel remains unknown.
Power and telecom share a reviewed-assumption coordination trench but use
separate owner enclosures. Gas uses a separate reviewed-assumption route, and
site lighting remains a distinct building-fed network. Every proposed route is
explicitly labeled `ASSUMED ROUTE`, carries dashed display styling in the
semantic model, and preserves unknown points of service, loads, capacities,
depths, separations, final grades, and owner approvals.

The grading/site-preparation slice uses the City of Eugene's two-foot contours
derived from 1999 orthophotos as reference-grade geometry only. The source
elevations remain labeled NGVD29 and are converted into the canonical NAVD88
model using NOAA VDatum / VERTCON 3.0 at a documented +3.698-foot parcel-center
shift (0.165-foot reported transformation uncertainty; 0.004-foot shift range
across the parcel). The original and converted elevation are retained on every
existing contour. Proposed grade, subgrade, spot elevations, drainage arrows,
cut/fill areas, disturbance limit, construction entrance, stockpile, and silt
fence are reviewed fictional assumptions. Earthwork values use screening-only
plan-area times average-depth calculations, not survey-to-surface volumes, and
are not bid or construction quantities.

The four City GIS taxlots are explicitly reference-derived and not survey
authority. They are the first geometry to replace when a real boundary survey
arrives. The fictional building/pad is separately marked as a reviewed
assumption, and every wall penetration has a permanent stable ID reserved for
later utility-network endpoint references.

## Repository layout

- `projects/hilyard/` — frozen project, source lock, and decision ledger
- `projects/cascade-commerce/` — controlled commercial canonical regression site
- `docs/model-studio-repeatability.md` — independent-source and controlled-site proof record
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
3. Build one full utility at a time, starting with sanitary. This repository now
   includes the first sanitary known-answer slice. Before routing,
   establish the minimum vertical envelope: reference existing surface,
   reviewed-assumption finished-floor elevation, available public main/manhole
   geometry and inverts, an explicitly assumed connection point, cited cover and
   slope rules, and validation. Then derive sanitary nodes, edges, structures,
   laterals, elevations, slopes, materials, cover, topology, provenance, and
   field details.
4. From the same passing canonical run, generate a vector PDF plan/profile,
   GeoPackage, and Excavation Field Map package and reconcile them by asset ID
   and actual artifact geometry. This is implemented for the sanitary slice.
5. The grading/site-preparation slice now adds reference and proposed surfaces,
   datum-labeled contours, spots, breaklines, drainage arrows, screening-only
   cut/fill areas, and temporary construction/erosion-control geometry without
   claiming survey, final design, or earthwork quantity authority.
6. The storm/roof-drainage slice now follows sanitary. It validates gravity,
   cover, structure drops, permanent-terminal connectivity, and a modeled
   storm-below-sanitary crossing while keeping capacity/HGL, infiltration,
   outfall approval, survey, and final grading explicitly unresolved.
7. The domestic/fire water slice now follows storm. It keeps the two pressure
   networks distinct, resolves both permanent wall terminals, checks declared
   cover and plan clearances against sanitary/storm, and refuses silent
   pressure, flow, capacity, or approval claims.
8. The dry-utility slice now follows water/fire. It models electric,
   telecom/fiber, gas, and site-lighting networks, preserves all four permanent
   terminal connections, represents power/telecom joint-trench coordination
   without claiming a shared physical vault, and forces every proposed route to
   remain visibly dashed and labeled as not located.
9. Paving/flatwork, ADA, and any jurisdiction-ready erosion-control or final
   grading design remain explicit future scope. The current grading and
   site-preparation layers exist only for product testing and must be superseded
   by current survey and licensed design for real work.

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
