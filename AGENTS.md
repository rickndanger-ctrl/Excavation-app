# Civil Plan Factory — Project Instructions

- This repository produces fictional product-development test data, never professional engineering services.
- Every generated model, report, sheet, and application package must state: `FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION`.
- The semantic civil job model is authoritative. Plans, profiles, sections, schedules, GeoPackage, DXF, GeoPDF, and app packages must derive from it.
- The primary product is an original custom plan authored in the semantic model. Found or uploaded plans may supply existing context, conventions, or extraction benchmarks, but never proposed geometry or a disguised deliverable.
- Preserve provenance as `confirmed`, `reference-derived`, `reviewed_assumption`, `generated`, or `unknown`; never silently convert an unknown into a design choice.
- Do not claim permit readiness, survey accuracy, utility capacity, professional engineering, or code compliance.
- Use strict test-driven development: write and observe a meaningful failing test before implementation, then run the focused and full suites.
- Use Python and the installed QGIS/GDAL toolchain. Keep source inputs checksum-locked and avoid committing large generated binaries.
- Never modify `/Users/richardholguin/Projects/excavation-field-map` from this repository; it is a read-only consumer-contract reference.
