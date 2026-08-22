# Oregon-Style Civil Test-Plan Conventions

> **FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION**
>
> This document translates public Oregon agency conventions into a generic product-test
> template. It is not a design standard, code-compliance statement, permit checklist, or
> substitute for a licensed engineer's jurisdiction-specific work.

## Research basis and authority boundary

The template uses the following public-agency material only to imitate familiar organization,
notation, and information hierarchy:

- Oregon Building Codes Division, *Plan Review Guide*: site plans identify property lines,
  buildings, distances, streets/parking/driveways, north orientation, and both written and
  graphic scales. Source: https://www.oregon.gov/bcd/Formslibrary/5854.pdf
- Oregon Building Codes Division, *Electronic document requirements and best practices*:
  large submissions may be split and named by discipline; site, plans, calculations, and
  geotechnical material remain distinguishable. Source:
  https://www.oregon.gov/bcd/epermitting/howto/Pages/elec-doc-req.aspx
- City of Eugene, *Public Improvement Design Standards Manual* (including the 2023 amendment):
  plan/profile presentation uses conventional engineering scales, aligned stationing, match
  lines, existing services, protected features, utility identifiers, and schedules for curb,
  ramp, and access data. Sources:
  https://www.eugene-or.gov/DocumentCenter/View/26574/2016-PIDS-Manual_FINAL and
  https://coeapps.eugene-or.gov/cmoweblink/0/edoc/3747870/Admin%20Order%2058-23-04%20--%20Amending%20PIDS%20Manual.pdf
- City of Portland, *Public Works Permitting Plans Preparation Guide*: discipline sheets
  emphasize the proposed system and fade contextual systems; plans balance completeness with
  field readability and commonly use 22-by-34-inch sheets and engineering scales. Source:
  https://www.portland.gov/ppd/infrastructure/documents/public-works-permitting-plans-preparation-guide/download
- Oregon DEQ, *ESCP Drawing Checklist*: erosion-control drawings depict boundaries,
  disturbance/cut-fill areas, pre/post drainage, discharge points, stockpiles, stabilized
  entrances, inlet protection, temporary/permanent conveyance, impervious areas, and relevant
  environmental constraints. Source: https://www.oregon.gov/deq/wq/Documents/ESCPFormsRev2f.pdf
- Oregon DOT, *Erosion Control Manual*: plan sheets use standard titles/numbers, notes,
  reference bubbles, existing contours, cut/fill lines, alignment stationing, easements,
  drainage systems, flow arrows, and sensitive-area boundaries. Source:
  https://www.oregon.gov/odot/GeoEnvironmental/Docs_Environmental/Erosion_Control_Manual.pdf

These sources do **not** authorize any generated dimension, slope, elevation, material,
capacity, connection, BMP, or facility. The factory records those project-specific values as
`reviewed_assumption` or `generated`, never `confirmed`.

## Generic sheet organization

The golden package uses as many coordinated sheets as readability requires, organized as:

1. `G0.00` Cover, disclaimer, vicinity diagram, sheet index, basis, legend, abbreviations.
2. `C1.xx` Existing conditions, reference control, property context, protection, erosion phase 1.
3. `C2.xx` Clearing, stripping, demolition/site preparation, temporary access, erosion phase 2.
4. `C3.xx` Earthwork, mass excavation, rough grading, pad, cut/fill, temporary drainage.
5. `C4.xx` Storm drainage plan/profile, structures, conveyance, treatment/detention concept.
6. `C5.xx` Sanitary plan/profile, structures, services, cleanouts, connections.
7. `C6.xx` Water/fire and dry-utility coordination, trench corridors, nodes and tie-ins.
8. `C7.xx` Fine grading, paving, curbs, walks, ramps, parking and site restoration.
9. `C8.xx` Profiles, schedules, sections, and project-specific test details as needed.

Each discipline sheet highlights its active system and retains the finished-site base and other
systems as subdued context. That same hierarchy becomes the EveSite layer stack.

## Graphic and annotation conventions

- Units are decimal feet unless a deliberately scoped architectural detail says otherwise.
- Every plan sheet shows a true/project north arrow, written engineering scale, graphic scale,
  datum/coordinate-basis note, legend, sheet number, revision, and disclaimer.
- Standard test scales are selected from 1 inch = 10, 20, 40, or 50 feet; profiles use a stated
  horizontal and vertical scale. The graphic scale remains valid if a PDF is resized.
- Existing/reference work uses lighter line weight; proposed work uses stronger system color or
  line weight; temporary work uses a distinct dashed treatment.
- Match lines avoid structures and intersections; stationing increases consistently along a
  named alignment; plan and profile references resolve by stable asset ID.
- Labels use stable IDs and a field-first priority: structure ID and rim/invert first, pipe size,
  material, slope and flow second, general area labels last.

## Discipline separation and construction sequence

The canonical phase catalog is:

1. Existing conditions / control / initial erosion protection.
2. Clearing / stripping / demolition / site preparation.
3. Mass excavation / rough grading / building pad / temporary access.
4. Storm drainage.
5. Sanitary sewer.
6. Water / fire service / dry-utility trenching.
7. Fine grading / paving / curb / sidewalk / ramps / parking / landscape restoration.

The canonical layer catalog is independent of phase: finished site, property/control,
existing conditions, grading, erosion/site preparation, storm, sanitary, domestic/fire water,
power, communications, gas, lighting, paving/curb, sidewalk/ADA, and landscape. A phase answers
*when*; a layer answers *what*.

## Minimum field callouts and schedules

- Gravity pipe: pipe ID, upstream/downstream node IDs, diameter, material, length, slope, flow
  direction, upstream/downstream invert, cover/depth basis, and profile reference.
- Pressure utility: route ID, size/material where intentionally assumed, length, cover/depth
  basis, valves/meters/backflow/hydrant or terminal IDs, owner-approval status, and unresolved
  capacity/pressure/fire-flow markers.
- Dry utility: route, conduit count/size where intentionally assumed, vault/handhole/pole or
  terminal IDs, cover basis, shared-trench relationship, owner status, and unknown load/capacity.
- Structures: stable ID, type, rim/top elevation, all in/out inverts, depth, connected asset IDs,
  and schedule/detail reference.
- Grading/site: existing/proposed spot grade, FFE/pad/subgrade, contour or grade-direction basis,
  slope, curb/sidewalk/paving dimensions and elevations, and cut/fill provenance.
- Layout: building and pavement dimensions, property/reference distances, and non-staking
  measurement/location tips derived from the same coordinates used by the app.

## Fictional-versus-generic rule

Generic conventions may include sheet naming, conventional scales, familiar symbols, annotation
order, schedules, north arrows, legends, phase/layer separation, and the *kinds* of information a
field crew expects. Project geometry, property, easements, controls, elevations, network routes,
connections, sizes, materials, slopes, quantities, capacities, BMP placement, and facility
performance remain fictional test inputs unless an explicit public reference is retained only as
non-survey context. No generated package claims approval, feasibility, compliance, or staking
authority.

## Golden-package acceptance template

A package passes only when the canonical model, plans, profiles, schedules, semantic manifest,
and EveSite view agree by stable ID and coordinate. With source imagery hidden, the complete
finished site must remain visible; each layer must align over it; every significant object must be
searchable/clickable; network endpoints must resolve; applicable details must expose dimensions,
elevations, slope/flow, and upstream/downstream relationships; the initial camera must frame the
whole model while preserving later pan/zoom; and every artifact must display the fictional-data
warning.
