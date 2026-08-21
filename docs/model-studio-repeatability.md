# Model Studio repeatability evidence

> FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION

This record separates independent public plan-set variability from controlled
canonical-model variation. Passing validation means the schema and artifact
contracts are internally consistent; it is not survey, engineering, permit,
utility-capacity, approval, or code readiness.

## Scoped inventory

The repository initially contained one modeled project, `projects/hilyard`,
and all committed outputs derived from that model. The scoped public research
archive under `/Users/richardholguin/Documents/excavation-plan-research`
contained the following usable plan sets. No unrelated or credential-bearing
files were opened or copied into this repository.

| Candidate | Selected evidence | SHA-256 | Assessment |
| --- | ---: | --- | --- |
| Phoenix, Oregon site/utility packet | 9 pages, 8,940,501 bytes | `7bad9077f7880ef20b7dc432272c93078058daa4f02d88541bc6636da1a5345e` | Strongest independent case: irregular boundary, road frontage, drainage/irrigation constraints, and several utility systems. |
| Park Drive Residences, Maine | 19 pages, 14,854,972 bytes | `2f29c2588c6654a9c97e519e26b0f61671d670bd5eba6ba5c853f1898961fcd5` | Feasible third intake; broad multi-sheet coverage, but not modeled here. |
| Redding/Canby apartment attachments | 14 pages, 4,642,981 bytes | `4e6b402b2bc9569ca69bb257a5e236f6bb1f27409d216150f2a3d47aceb01f5a` | Useful secondary archive, weaker than Phoenix for a focused utility proof. |
| Oregon City packet | 86-page source packet | `bab7cad8f0233b6604f1bcbbfb1a7d97ca8d02a32405b68002959b8615afbf8d` | Research manifest had no selected civil sheets; not advanced. |

## Independent public-source runs

Phoenix was created in an isolated Model Studio workspace and added through
the PDF intake API. The source remained `unknown`, supported no model claims,
and was not committed. Model Studio reported 37 blockers: missing CRS, datum,
and units plus missing required system coverage and interfaces. One recovery
note was recorded and remained `reviewed_not_cleared`. Execution stopped at
validation, publication was refused, and no Field Map import file existed.

Measured local operator/API time was 0.035 seconds total: 0.001 create, 0.009
intake/checksum, 0.006 review recording, and 0.015 canonical run (rounded).
Manual interventions were selecting the public sheets and recording the note.
Source interpretation/model authoring was intentionally not performed.

Park Drive repeated create, 19-sheet intake, checksum lock, validation, and
failed publication in 0.057 seconds. It produced the same 37 foundational
blockers. Its sole manual intervention was source-sheet selection. This third
case confirms intake/fail-closed behavior, not a modeled or publishable site.

Model Studio now groups blockers into actionable `spatial_basis`,
`system_coverage`, `source_integrity`, and `canonical_model` readiness groups.
Review notes remain audit evidence and cannot clear a gate.

## Controlled commercial canonical run

`projects/cascade-commerce/project.json` is the second controlled canonical
site. It is authored regression data, not a claim about a real parcel. It adds:

- an irregular multi-segment parcel and different controlled constraints;
- an L-shaped commercial service/warehouse footprint and loading access;
- relocated permanent interfaces and distinct sanitary/storm routing;
- a loading-apron storm branch into the controlled planter path;
- rerouted dry-utility coordination geometry;
- different drainage arrows and grading expression; and
- deliberate `confirmed`, `reference-derived`, `reviewed_assumption`,
  `generated`, and `unknown` provenance.

The run had zero validation issues. It created the vector PDF, GeoPackage,
semantic manifest, validation report, and parity report in 0.659 seconds, then
published in 0.003 seconds. Selection/readiness inspection took 0.003 seconds;
total measured machine time was 0.665 seconds. No manual intervention was
required after selecting the authored project.

The package was accepted without modification by the read-only Field Map
`parseSemanticJobsiteManifest` contract as
`excavation-field-map.jobsite-package/v0.1.0`, with 125 objects and 11 consumer
layers. The explicit local import seam is:

`.model-studio/published/cascade-commerce/<publication-sha256>/semantic-manifest.json`

The handoff is immutable and content addressed. Remote delivery remains
`not_configured`; no endpoint or credentials are fabricated.

## Generalized defects found

The exercise removed project-name coupling from filenames, PDF titles/footer
labels, key rendered feature IDs, parity text checks, and Field Map plan
metadata. It also found that run history was sorted by content-addressed folder
name rather than completion time, which could display an older failed run as
current. Run history is now time ordered and regression tested.
The console also marks historical runs stale when the authoritative project
fingerprint changes, so an old passing publication can never appear ready for
new, unvalidated inputs.
