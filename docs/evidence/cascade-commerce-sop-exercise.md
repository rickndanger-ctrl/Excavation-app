# Cascade Commerce SOP exercise — 2026-08-21

> FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION

## Outcome

- **SOP instruction result:** PASS. The operator could follow the documented factory-window, canonical-run, immutable-publish, consumer-import, layer-toggle, comparison, timing, issue, and recovery steps.
- **Case closeout status:** `BLOCKED — external/human evidence required` for a full end-to-end phone pass. A phone-sized browser run passed, but physical phone hardware was not exercised; this was kept explicit rather than converted to a pass.
- **Engineering/readiness claim:** none. Canonical validation/parity passing means internal schema and artifact consistency only.
- **Ten-case program:** not started.

## Case control

| Field | Evidence |
| --- | --- |
| Selection reason | Already-proven controlled commercial fixture with irregular parcel, L-shaped commercial building/loading use, wet/dry utility topology, grading/drainage, and all five provenance categories. Used to test the SOP itself, not independent source variability. |
| Project | `cascade-commerce-controlled-test` / `cascade-commerce` |
| Revision | `controlled-commercial-1.0.0` |
| Repository commit at closeout | `bb4ee36aab390c16ae47a16673cb28a7a462e088` |
| Project fingerprint | `701642065d7ce4937b02df31303df7cefc50c0e940aca1d5c817d87f5da27718` |
| Source controls | 18/18 embedded revision locks; controlled authored fixture; no uploaded source-plan PDF claimed |
| Provenance | 11 confirmed; 45 reference-derived; 132 reviewed assumptions; 38 generated; 9 unknown |
| Human-review load | 11 decisions (`reviewed_assumption` or `unknown`) |

The 18 controlled authoring bases use `embedded_revision_locked`, not PDF SHA locks. The factory window correctly distinguishes zero checksum-locked PDFs from 18 locked source records.

## Canonical run and immutable publication

| Field | Result |
| --- | --- |
| Run ID | `controlled-commercial-1-0-0-701642065d7ce493` |
| Start / completion | `2026-08-21T21:48:26.039919Z` / `2026-08-21T21:48:26.819270Z` |
| Automated time | 0.779 seconds (derived from locked run timestamps for the pre-observability run) |
| Validation | valid; 0 active issues |
| Parity | valid |
| Publication readiness | ready |
| Publication ID | `e857e9bd9bc73b01331d0044104b5c10434579134be93d337a86d3a1810259f4` |
| Import seam | `.model-studio/published/cascade-commerce/e857e9bd9bc73b01331d0044104b5c10434579134be93d337a86d3a1810259f4/semantic-manifest.json` |
| Remote delivery | `not_configured` |

The SOP exercise invoked **Run canonical pipeline** and **Publish immutable package** through the console. Because authoritative bytes were unchanged, the canonical path returned the existing content-addressed run and idempotent immutable publication.

Locked artifact SHA-256 values:

| Artifact | SHA-256 |
| --- | --- |
| `cascade-commerce-site.gpkg` | `d2ee33c3469353f65979388445a982c20dfcded2535a64e56f4c9cfb16ec9b37` |
| `cascade-commerce-site.pdf` | `06a212fc5634f2f215020409097eb1de379b9dacadcddc6b3bc9281966e1b44a` |
| `parity-report.json` | `ee393ddf8d9478ba789be4304fd82bdc66f61eb5cc22c12a1cc612db9a1b74d1` |
| `semantic-manifest.json` | `240b13d1c919f429461b6b6ae39d6726313e39a45ea0b651adc774a46cdd8e81` |
| `validation-report.json` | `8a621956c189c24594879c4322ab194a9a844457373a539b8d58713f13a6875f` |

## Operator touches and timing

The console recorded 162 seconds of hands-on operator time separately from automated time:

| Activity | Seconds | Evidence |
| --- | ---: | --- |
| Metadata/revision review | 30 | Verified case identity, revision, fingerprint, 18 source locks, provenance mix, and handoff. |
| Phone-sized layer check | 60 | Imported immutable package; verified correct project/disclaimer/125 features; toggled all ten visible layer groups off/on and restored counts. Physical phone not exercised. |
| Source-to-phone comparison | 60 | Compared ten representative stable IDs and inspected assumed-electric safety/provenance fields. |
| Repair regression | 12 | Repeated operator-touch submission after the async form fix; form reset, UI refreshed, prior touches remained, and no error appeared. |

Result classification remains `not_assessed` because the physical-phone criterion is outstanding. No UI or passing canonical run inferred a final operator classification.

## Read-only Field Map contract and phone-sized checks

The published manifest was passed without modification to the read-only consumer `parseSemanticJobsiteManifest` contract:

```json
{"id":"cascade-commerce-controlled-test","schemaVersion":"excavation-field-map.jobsite-package/v0.1.0","disclaimer":"FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION","objects":125,"layers":11}
```

At a 390 × 844 viewport, the local import showed the correct controlled project, exact disclaimer, 125 features, and finished-site overview. The ten operator-visible layer groups all disappeared and returned with their original counts:

| Layer control | Rendered feature count |
| --- | ---: |
| Property / Constraints | 12 |
| Grading / Surfaces | 29 |
| Sanitary Sewer | 9 |
| Storm / Roof Drainage | 20 |
| Domestic Water | 8 |
| Fire Water | 12 |
| Water Source Reference | 1 |
| Gas / Power / Telecom / Lighting | 25 |
| Building / Site | 5 |
| Construction / Erosion Control | 4 |

The consumer showed a Supabase/project-list error in the credential-free local environment, while the offline local-file package import and map controls remained operable. This is an external/remote-listing limitation, not producer contract evidence.

## Source-to-phone sample

Each canonical stable ID appeared exactly once on the expected phone layer:

| Coverage | Stable ID | Phone layer | Result |
| --- | --- | --- | --- |
| Boundary/reference parcel | `taxlot-10900` | property | pass |
| Surface | `surface-existing-sanitary-reference` | grading | pass |
| Sanitary | `sanitary-service-seg-02` | sanitary | pass |
| Storm/loading drainage | `storm-loading-apron-branch-01` | storm | pass |
| Domestic water | `domestic-water-seg-02` | domestic-water | pass |
| Fire water | `fire-water-seg-02` | fire-water | pass |
| Water reference | `water-public-main-34th-reference` | water-reference | pass |
| Dry utility/interface | `penetration-electric` | dry-utilities | pass |
| Commercial building | `building-commercial-1` | site | pass |
| Temporary control | `site-prep-construction-entrance-01` | construction-erosion | pass |

The selected `penetration-electric` field sheet retained `Reviewed_assumption`, an `ASSUMED` display badge, unknown capacity and owner approval, and an explicit “not designed or EWEB-approved” unavailable reason.

## Defects found by exercising the SOP

1. **S3 — source-lock counter semantics.** The first live factory window showed `0 / 18` because it counted only `checksum_locked`; the controlled fixture uses `embedded_revision_locked`. It also automatically displayed a passing result before human phone classification. Commit `840186d` now counts every declared `*locked` record while preserving the checksum-only count in the API, and leaves result classification `not_assessed` until an operator records it. Focused regression added.
2. **S3 — async form target lifecycle.** Operator-touch records reached the server but the browser then displayed `Cannot read properties of null (reading 'reset')`; DOM event `currentTarget` was cleared after the awaited request. Commit `bb4ee36` captures each form synchronously before awaiting for create, review, and operator-touch flows. Focused regression and live browser resubmission passed.

Neither defect altered the authoritative model, gate outcome, or immutable publication. No validation was weakened and no engineering input was invented.

## Evidence and cleanup

- Persistent audit state: `.model-studio/operator-touches/cascade-commerce.json`
- Run/publication evidence: ignored `.model-studio/runs/` and `.model-studio/published/`
- Browser snapshots/logs: ignored `.model-studio/evidence/sop-exercise-2026-08-21/`
- Large generated PDF/GeoPackage and app bundles: not committed
- Field Map source repository: unchanged; Playwright artifacts generated during the read-only check were moved back into the producer's ignored evidence directory
- Physical phone: not performed; remains the explicit blocker for full end-to-end PASS

Final verification after both repairs: 104/104 producer tests passed. The
read-only consumer adapter regression passed 3/3 tests, in addition to the
published Cascade package parse, phone-sized layer-toggle loop, and ten-ID
comparison recorded above. Model Studio remained healthy and supervised by its
single pm2 process.
