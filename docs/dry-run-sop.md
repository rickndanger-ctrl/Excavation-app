# Model Studio dry-run standard operating procedure

> FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION

## Purpose and definition of success

This procedure governs every Model Studio dry run, including the planned ten-case validation matrix. It makes the workflow observable, repeatable, checksum locked, fail closed, and reviewable by a solo operator.

“100%” means every **verifiable, in-scope acceptance criterion** in this SOP is satisfied and every unknown, limitation, reviewed assumption, and unavailable system is explicitly represented. It never means fabricated certainty, survey authority, professional engineering approval, utility capacity, permit readiness, code compliance, or construction readiness.

Do not begin a case if its selection reason, source custody, revision, operator, or evidence location is missing.

## Roles and decision authority

One person may perform several roles, but each decision must be recorded under the role that made it.

| Role | Responsibility | Human decision required |
| --- | --- | --- |
| Case owner | Selects the case, identifies the coverage reason, freezes job ID and revision. | Admit, defer, or reject a case from the matrix. |
| Intake operator | Acquires allowed source plans and verifies filename, bytes, checksum, and custody. | Accept a checksum match or stop on mismatch. |
| Model author | Updates the authoritative semantic civil job model and ledgers. | Interpret source content; assign provenance; retain unknowns. |
| Validation reviewer | Reads every gate and determines whether a failure is expected incomplete-input behavior or a pipeline defect. | Assign result classification; approve repairs for rerun. |
| Phone verifier | Imports the immutable package into Field Map and performs layer and comparison sampling. | Accept or reject the phone rendering/import evidence. |
| Release operator | Publishes only a current passing run and closes the report. | Confirm all evidence exists before final pass. |

No review note, operator classification, or role may downgrade, waive, or clear a canonical validation gate. Only a corrected authoritative model followed by a passing canonical rerun can clear it.

## 1. Select the case and matrix purpose

Record the case ID, project slug, source type, expected geometry/system mix, and why it belongs in the matrix before intake. A case must add at least one useful dimension:

- independent source formatting, jurisdiction, sheet organization, or revision;
- irregular boundary, easement, ROW, wetland, or other constraint geometry;
- residential, commercial, industrial, or mixed building/use pattern;
- materially different sanitary, storm, water/fire, dry-utility, grading, or access topology;
- a deliberately different provenance distribution; or
- an intentionally incomplete plan set that proves correct fail-closed behavior.

Reject novelty-only cases. Avoid unrelated private data. Never use a controlled fictional model as evidence of independent source variability; label controlled regression cases separately.

## 2. Freeze source-plan intake and checksum evidence

1. Confirm the file is an authorized plan-set PDF and contains no unrelated private material.
2. Record original filename, page count when available, byte size, source location/citation, acquisition date, and source revision/date.
3. In Model Studio, create or select the project and drop/select the PDF.
4. Confirm Model Studio stores a content-addressed copy and displays the SHA-256 prefix under **Input and checksum evidence**.
5. Independently compare the full SHA-256 in `sources.lock.json` with the stored intake bytes. Stop on any mismatch.
6. Confirm new intake remains `unknown`, supports no claims, and names its unavailability until a human reviews it into the canonical model.

Screenshots are supplemental; the checksum ledger and stored bytes are the primary evidence.

## 3. Freeze job metadata and revision controls

Before authoring or running, record case ID and slug; project name and semantic ID; source and canonical revisions; CRS/units/datum/benchmark/transformations/tolerances or explicit unknowns; repository commit and project fingerprint; operator, start time, and evidence directory.

If any authoritative project file, source lock, decision ledger, or intake byte changes, the previous run becomes stale. Reconcile the revision, review the changed fingerprint, and rerun. Never publish an earlier pass against changed inputs.

## 4. Author the canonical semantic model

The semantic civil job model is authoritative. The console invokes the canonical loader, validator, builder, parity checks, and exporter; it must not contain parallel geometry or engineering logic.

For every modeled source, decision, feature, surface, and network object:

1. use a stable ID and supported geometry type;
2. connect network endpoints to resolvable permanent or field interfaces;
3. cite the source/decision basis;
4. preserve exactly `confirmed`, `reference-derived`, `reviewed_assumption`, `generated`, or `unknown` provenance;
5. retain missing survey, hydraulic, capacity, approval, ownership, or code information as `unknown` or unavailable with a reason;
6. describe reviewed assumptions as assumptions, never facts; and
7. retain `FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION` in every required model, report, sheet, package, and handoff.

Human review is mandatory for source interpretation, model assumptions, provenance changes, apparent plan conflicts, datum transformations, and the decision to classify a stopped run.

## 5. Run Model Studio step by step

1. Open `Model Studio.app`; confirm the expected local repository and exact disclaimer.
2. Select the project. Verify name, project ID, revision, and project path.
3. Read **Factory window**: current stage/action, fingerprint, source locks, human-review count, prior operator touches, and result class.
4. Confirm the intake count and every displayed checksum/provenance row.
5. Select **Run canonical pipeline** once. Do not start a competing server or second run.
6. Watch queued/running stage and elapsed automated time. A normal run ends `complete` or `blocked`.
7. Read every validation outcome and grouped readiness blocker.
8. Record each human action in **Record operator touch** with activity, minutes, evidence/decision note, and result classification when known.
9. Record recovery notes only to guide repair. Notes do not clear gates.
10. Publish only when the current run, validation, and parity read **Ready**.
11. Record publication ID, handoff manifest, import file, artifact hashes, and location.

## 6. Classify a stop correctly

Choose `valid_fail_closed_incomplete_plans` only when the software behaves as specified and blockers come from absent/unresolved source facts, coverage, interfaces, datum/control, ownership, capacity, or required human review. Expected evidence is deterministic issue codes/paths, actionable blocker groups, no publication/import file, preserved unknowns, and no crash, corruption, silent omission, or bypass. This is valid safety behavior, not a publishable job.

Choose `pipeline_defect` for a crash, hang, nondeterministic result, stale/latest-run error, checksum drift, missing expected artifact, parity inconsistency, UI/state mismatch, consumer-contract failure, or any gate bypass/misclassification. Never relabel a defect as incomplete plans to keep the matrix green.

When uncertain, stop as `not_assessed`, preserve evidence, and obtain human review.

## 7. Validation and publication gates

Publication is permitted only when the run fingerprint is current; canonical validation is `valid` with zero errors; parity is `valid`; the semantic schema is `excavation-field-map.jobsite-package/v0.1.0`; locked artifact hashes still match; the exact disclaimer is present; and no unresolved S1/S2 defect exists.

The publication must be immutable/content addressed, and repeated publish must return the same publication. A changed or missing destination artifact is a hard stop.

## 8. Phone publication and layer-toggle checks

Use the published `semantic-manifest.json`, never an unvalidated run folder. The Field Map repository is read-only from this workflow.

1. Import the exact file shown under **Outputs and handoff**.
2. Confirm project name/ID, revision/model version, disclaimer, and schema.
3. Confirm the overview fits the expected site and did not silently select a cached project.
4. Toggle every expected system/layer off and on individually.
5. Change phase filters where applicable and verify controls remain operable.
6. Select representative points, lines, polygons, and surfaces; check stable ID, type, provenance warnings, and available field details.
7. Confirm unknown/assumed routes retain unmistakable safety messaging.
8. Capture viewport, project menu, layer controls, and selected-feature evidence.

If physical phone testing is unavailable, record the limitation and use the consumer phone-sized automated contract only as provisional evidence. Do not claim the physical-phone criterion passed.

## 9. Source-to-phone comparison sampling

Sample at minimum: parcel/boundary plus one constraint; building, access, and one permanent interface; one feature from every available wet/dry utility; one storm/drainage route and terminal; one grading surface/contour/spot/drainage arrow when in scope; and every item implicated by a prior defect.

For each, record source sheet/page or controlled-model object, canonical stable ID, displayed layer, topology/relative geometry, source-backed material/size/elevation fields, provenance, and pass/fail. This tests representation and traceability, not survey accuracy.

## 10. Acceptance criteria and stop conditions

A run passes only when case rationale/metadata, source bytes/checksums, revision/fingerprint, provenance/unknowns, intended canonical gate outcome, immutable handoff for publishable cases, unchanged consumer acceptance, required phone/layer and comparison samples, separate operator/automated time, classified issues, and the final evidence index are complete.

Stop immediately for checksum mismatch, wrong project/revision, missing disclaimer, unexplained provenance conversion, stale run, competing service, crash/hang, nondeterminism, corrupted artifact, parity failure, publication bypass, changed immutable handoff, wrong consumer project, or unresolved S1/S2 issue.

## 11. Issue severity, repair, and regression

| Severity | Definition | Required action |
| --- | --- | --- |
| S1 critical | Gate bypass, wrong package, corrupted source, lost unknown/provenance, false readiness claim, destructive behavior. | Stop program; preserve evidence; repair and regress before any case. |
| S2 major | Crash/hang, missing artifact/layer/system, wrong topology/parity, unrecoverable workflow, repeatability failure. | Stop case; focused and representative regression before continuing. |
| S3 moderate | Actionable UI ambiguity, wrong stage/latest display, incomplete evidence/timing, recoverable operator error. | Repair before relying on the affected criterion; add regression. |
| S4 minor | Cosmetic/documentation issue that cannot change decisions or outputs. | Record and schedule; regress when behavior is testable. |

Repair the smallest authoritative cause. Never change data or weaken validation merely to pass. Rerun the focused failure, affected case, prior known-answer fixture, full producer suite, and representative read-only consumer contract. Preserve the failed record and create new repair evidence.

## 12. Evidence, screenshots, logs, and timing

Create one case evidence index with disclaimer; rationale; source/checksum/revision/commit/fingerprint; stage timeline; automated seconds; operator touches; validation/parity and issues; run/publication IDs and hashes; consumer result; phone/browser evidence; comparison samples; defects/severity/repair/regressions; and cleanup.

Keep large PDFs, GeoPackages, generated apps, video, and screenshots out of git unless policy explicitly allows them. Commit concise text/JSON evidence and hashes; store generated evidence in ignored state. Automated time comes from the operation/run record. Operator time contains hands-on minutes only, not unattended build time.

## 13. Final report

Close as one of:

- `PASS — verifiable gates and phone criteria satisfied`;
- `VALID FAIL-CLOSED — incomplete plans; not publishable`;
- `FAIL — pipeline defect`;
- `BLOCKED — external/human evidence required`; or
- `NOT ASSESSED — evidence incomplete`.

Name every unmet criterion and unknown. A valid fail-closed result is positive safety evidence, not a publishable pass.

## 14. Rollback and cleanup

1. Preserve failed runs, reviews, operator touches, and immutable publications used as evidence.
2. Remove only disposable isolated state and temporary browser artifacts after results are captured.
3. Never edit the read-only Field Map consumer repository.
4. Use the committed launcher/pm2 configuration; never start an unsupervised competing server.
5. Revert model changes only through reviewed git changes; never broad-reset a dirty worktree.
6. Confirm the intended project, `model-studio` health identity, and a clean evidence index for the next case.

