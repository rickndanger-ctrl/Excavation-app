/**
 * Willow Creek Retail Center — Mock Oregon Excavation Plan Set
 *
 * Coordinate system:
 *   Real site: N 0–515 ft (south→north), E 0–410 ft (west→east)
 *   App coords: x = easting (ft), y = 515 − northing (ft)
 *     → y=0 is the NORTH edge, y=515 is the SOUTH edge
 *
 *   plan.widthFt  = 410  (real site width in feet)
 *   plan.heightFt = 515  (real site height in feet)
 *
 *   The aerial image (1536×1024 landscape) is stretched via CSS to fill
 *   the 410×515 plan canvas. Features align approximately with the image.
 *   Use calibration points for exact GPS alignment in the field.
 *
 * Source: oregon_excavation_mock_plan_set.md + app_layer_seed_data.csv
 * Status: mock training/reference set only. Not stamped engineering.
 */

import type { JobsitePackage } from '../types/jobsite';

export const sampleWillowCreek: JobsitePackage = {
  id: 'willow-creek-retail',
  projectName: 'Willow Creek Retail Center',
  plan: {
    imageUrl: '/willow-creek-aerial.png',
    widthFt: 410,
    heightFt: 515,
  },

  // ── Phases ────────────────────────────────────────────────────────────────
  phases: [
    {
      id: 'phase-0',
      name: 'Ph 0 — Preconstruction & Control',
      summary:
        'Set construction control (CP-1 through CP-6), verify property corners and easements, calibrate site grid in app, mark exclusion zones around live utilities.',
    },
    {
      id: 'phase-1',
      name: 'Ph 1 — Mobilization & Initial ESC',
      summary:
        'Install stabilized construction entrance, perimeter sediment fence, straw wattles, concrete washout, and stockpile zones before any ground disturbance.',
    },
    {
      id: 'phase-2',
      name: 'Ph 2 — Demo, Clearing & Stripping',
      summary:
        'Strip 6-inch topsoil across 4.36 acres, remove old asphalt, remove abandoned 6-inch CMP culvert, sawcut public frontage pavement, protect live utilities.',
    },
    {
      id: 'phase-3',
      name: 'Ph 3 — Mass Earthwork & Rough Subgrade',
      summary:
        'Balance cut (9,850 cy) and fill (8,900 cy), over-excavate building pad 18 in., create temporary drainage swale to sediment trap ST-1.',
    },
    {
      id: 'phase-4',
      name: 'Ph 4 — Storm Drain & Infiltration',
      summary:
        'Install storm trunk from frontage overflow down to drywells, set catch basins after rough curb lines staked. Drywells last — protect from sediment until final stabilization.',
    },
    {
      id: 'phase-5',
      name: 'Ph 5 — Sanitary Sewer',
      summary:
        'Pothole existing main, install SAN-MH-1 tie-in, run 8-inch gravity main upstream, install building laterals and cleanouts, air/vacuum test before backfill.',
    },
    {
      id: 'phase-6',
      name: 'Ph 6 — Water, Fire & Domestic',
      summary:
        'Tap 12-inch public main, extend 8-inch water line, set hydrants and valves, install fire service and domestic meter vaults, pressure test and disinfect before service.',
    },
    {
      id: 'phase-7',
      name: 'Ph 7 — Dry Utilities',
      summary:
        'Excavate joint utility trench, set electric/comm vaults, install transformer pad, pull lighting conduit and pole bases, as-built survey.',
    },
    {
      id: 'phase-8',
      name: 'Ph 8 — Flatwork, Pads & Subgrade',
      summary:
        'Trim building pad subgrade, fine-grade curb/sidewalk/ADA subgrade, prep trash enclosure slab, proof-roll pavement subgrade before aggregate base.',
    },
    {
      id: 'phase-9',
      name: 'Ph 9 — Final Stabilization & As-Builts',
      summary:
        'Restore landscape, remove temporary erosion controls after stabilization, capture final as-built coordinates and elevations for all features.',
    },
  ],

  // ── Layers ─────────────────────────────────────────────────────────────────
  layers: [
    { id: 'base-control',  name: 'Control / Property',      color: '#6b7280', defaultVisible: true  },
    { id: 'esc',           name: 'Erosion Control',          color: '#9f7aea', defaultVisible: true  },
    { id: 'storm',         name: 'Storm Drain',              color: '#1d8fe1', defaultVisible: true  },
    { id: 'sanitary',      name: 'Sanitary Sewer',           color: '#9333ea', defaultVisible: true  },
    { id: 'water',         name: 'Water & Fire',             color: '#16a34a', defaultVisible: true  },
    { id: 'dry-util',      name: 'Dry Utilities',            color: '#f97316', defaultVisible: true  },
    { id: 'flatwork',      name: 'Flatwork / Pads',          color: '#b45309', defaultVisible: true  },
    { id: 'safety',        name: 'Safety / Hazards',         color: '#dc2626', defaultVisible: true  },
  ],

  // ── Utility Lines ──────────────────────────────────────────────────────────
  // Coordinates: x = easting (ft), y = 515 − northing (ft)
  utilities: [
    // Property boundary
    {
      id: 'property-boundary',
      layerId: 'base-control',
      label: 'Property Boundary',
      points: [
        { x: 0,   y: 515 }, // SW  E=0,  N=0
        { x: 0,   y: 0   }, // NW  E=0,  N=515
        { x: 410, y: 0   }, // NE  E=410,N=515
        { x: 410, y: 515 }, // SE  E=410,N=0
        { x: 0,   y: 515 }, // close
      ],
    },

    // Storm trunk — STM-MH-1 → STM-SMH-2 → STM-WQ-3
    {
      id: 'storm-trunk',
      layerId: 'storm',
      label: 'Storm Trunk 18" RCP',
      phase: 'phase-4',
      points: [
        { x: 214, y: 65  }, // STM-MH-1   E=214,N=450
        { x: 214, y: 125 }, // STM-SMH-2  E=214,N=390
        { x: 214, y: 179 }, // STM-WQ-3   E=214,N=336
      ],
    },

    // Storm to drywell gallery
    {
      id: 'storm-to-drywells',
      layerId: 'storm',
      label: 'Storm to Drywell Gallery',
      phase: 'phase-4',
      points: [
        { x: 214, y: 179 }, // STM-WQ-3  N=336
        { x: 198, y: 203 }, // DW-1      N=312
        { x: 214, y: 203 }, // DW-2
        { x: 230, y: 203 }, // DW-3
      ],
    },

    // Storm laterals
    {
      id: 'storm-lateral-cb1',
      layerId: 'storm',
      label: 'Storm Lateral CB-1',
      phase: 'phase-4',
      points: [
        { x: 110, y: 83  }, // CB-1  E=110,N=432
        { x: 214, y: 65  }, // STM-MH-1
      ],
    },
    {
      id: 'storm-lateral-cb2',
      layerId: 'storm',
      label: 'Storm Lateral CB-2',
      phase: 'phase-4',
      points: [
        { x: 188, y: 107 }, // CB-2  E=188,N=408
        { x: 214, y: 125 }, // STM-SMH-2
      ],
    },
    {
      id: 'storm-lateral-cb3',
      layerId: 'storm',
      label: 'Storm Lateral CB-3',
      phase: 'phase-4',
      points: [
        { x: 108, y: 165 }, // CB-3  E=108,N=350
        { x: 214, y: 179 }, // STM-WQ-3
      ],
    },
    {
      id: 'storm-lateral-cb456',
      layerId: 'storm',
      label: 'Storm Lateral CB-4/5/6',
      phase: 'phase-4',
      points: [
        { x: 162, y: 227 }, // CB-4  E=162,N=288
        { x: 250, y: 277 }, // CB-5  E=250,N=238
        { x: 322, y: 341 }, // CB-6  E=322,N=174
        { x: 214, y: 203 }, // DW-2 manifold
      ],
    },

    // Sanitary sewer main
    {
      id: 'sanitary-main',
      layerId: 'sanitary',
      label: 'Sanitary Sewer 8" PVC',
      phase: 'phase-5',
      points: [
        { x: 58,  y: 77  }, // SAN-MH-1  E=58,N=438
        { x: 70,  y: 177 }, // SAN-MH-2  E=70,N=338
        { x: 92,  y: 297 }, // SAN-MH-3  E=92,N=218
      ],
    },

    // Building laterals to sanitary
    {
      id: 'sewer-lateral-retail',
      layerId: 'sanitary',
      label: 'Sewer Lateral — Retail',
      phase: 'phase-5',
      points: [
        { x: 150, y: 267 }, // SS-CO-1
        { x: 210, y: 267 }, // SS-CO-2
        { x: 92,  y: 297 }, // SAN-MH-3
      ],
    },
    {
      id: 'sewer-lateral-coffee',
      layerId: 'sanitary',
      label: 'Sewer Lateral — Coffee Pad',
      phase: 'phase-5',
      points: [
        { x: 282, y: 399 }, // SS-CO-3  E=282,N=116
        { x: 92,  y: 297 }, // SAN-MH-3
      ],
    },

    // Water main
    {
      id: 'water-main',
      layerId: 'water',
      label: 'Water Main 8" DIP',
      phase: 'phase-6',
      points: [
        { x: 74,  y: 59  }, // W-TAP-1  E=74,N=456
        { x: 74,  y: 77  }, // W-V-1    E=74,N=438
        { x: 70,  y: 139 }, // FH-1     E=70,N=376
        { x: 122, y: 261 }, // FIRE-1   E=122,N=254
        { x: 118, y: 245 }, // DOM-1    E=118,N=270
        { x: 258, y: 397 }, // DOM-2    E=258,N=118
        { x: 332, y: 383 }, // FH-2     E=332,N=132
      ],
    },

    // Joint utility trench
    {
      id: 'joint-util-trench',
      layerId: 'dry-util',
      label: 'Joint Utility Trench',
      phase: 'phase-7',
      points: [
        { x: 356, y: 59  }, // JUT-1  E=356,N=456
        { x: 356, y: 105 }, // EV-1   E=356,N=410
        { x: 356, y: 231 }, // TX-1   E=356,N=284
        { x: 326, y: 337 }, // EV-2   E=326,N=178
      ],
    },

    // ── Flatwork Lines — Curb Perimeter ────────────────────────────────────────
    // Drawn along the back of curb. Reveal = 10 in above adj. asphalt.
    // Tap the CRB-* point markers for per-station elevation data.
    {
      id: 'curb-north',
      layerId: 'flatwork',
      label: 'North Curb Line',
      phase: 'phase-8',
      points: [
        { x: 87,  y: 68 }, // west curb return
        { x: 105, y: 64 },
        { x: 155, y: 62 }, // CRB-N1 station
        { x: 215, y: 60 }, // entry drive throat
        { x: 250, y: 60 },
        { x: 310, y: 62 }, // CRB-N2 station
        { x: 360, y: 65 },
        { x: 370, y: 68 }, // east curb return
      ],
    },
    {
      id: 'curb-west',
      layerId: 'flatwork',
      label: 'West Curb Line',
      phase: 'phase-8',
      points: [
        { x: 87,  y: 68  }, // meets north curb return
        { x: 90,  y: 100 },
        { x: 90,  y: 145 }, // CRB-W1 station
        { x: 90,  y: 200 },
        { x: 90,  y: 250 },
        { x: 90,  y: 318 }, // meets south curb corner
      ],
    },
    {
      id: 'curb-east',
      layerId: 'flatwork',
      label: 'East Curb Line',
      phase: 'phase-8',
      points: [
        { x: 370, y: 68  }, // meets north curb return
        { x: 370, y: 100 },
        { x: 310, y: 140 },
        { x: 310, y: 185 }, // CRB-E1 station
        { x: 310, y: 255 },
        { x: 310, y: 318 }, // meets south curb
      ],
    },
    {
      id: 'curb-south',
      layerId: 'flatwork',
      label: 'South Curb Line',
      phase: 'phase-8',
      points: [
        { x: 90,  y: 318 },
        { x: 140, y: 318 },
        { x: 200, y: 318 }, // CRB-S1 station
        { x: 260, y: 318 },
        { x: 310, y: 318 },
      ],
    },

    // ── Flatwork Lines — Sidewalks ─────────────────────────────────────────────
    {
      id: 'sidewalk-north',
      layerId: 'flatwork',
      label: 'North Sidewalk — 6 ft wide, 4 in concrete',
      phase: 'phase-8',
      points: [
        { x: 90,  y: 54 }, // SWK-N1 west end
        { x: 130, y: 52 },
        { x: 200, y: 51 }, // SWK-N1 center point marker
        { x: 270, y: 52 },
        { x: 340, y: 53 },
        { x: 370, y: 55 }, // SWK-N1 east end
      ],
    },
    {
      id: 'sidewalk-west-building',
      layerId: 'flatwork',
      label: 'West Building Sidewalk — 6 ft wide, 4 in concrete',
      phase: 'phase-8',
      points: [
        { x: 50,  y: 90  }, // connects to north walk
        { x: 50,  y: 130 },
        { x: 50,  y: 185 }, // SWK-W1 center point marker
        { x: 50,  y: 240 },
        { x: 50,  y: 295 }, // south end at building corner
      ],
    },
  ],

  // ── Objects ────────────────────────────────────────────────────────────────
  // Coordinates: x = easting (ft), y = 515 − northing (ft)
  objects: [
    // ── Phase 0 — Control / Property Corners ────────────────────────────────
    {
      id: 'CP-1',
      type: 'control_point',
      layerId: 'base-control',
      x: 0, y: 515,  // SW  E=0, N=0
      label: 'CP-1 — SW Corner',
      phase: 'phase-0',
      elevation: 'N 0.0 / E 0.0',
      notes: 'Local grid origin. Verify with survey before app calibration.',
      workerLabel: 'SW property corner',
      safetyFlag: 'none',
    },
    {
      id: 'CP-2',
      type: 'control_point',
      layerId: 'base-control',
      x: 0, y: 0,   // NW  E=0, N=515
      label: 'CP-2 — NW Corner',
      phase: 'phase-0',
      elevation: 'N 515.0 / E 0.0',
      notes: 'NW property corner. Verify with survey before app calibration.',
      workerLabel: 'NW property corner',
      safetyFlag: 'none',
    },
    {
      id: 'CP-3',
      type: 'control_point',
      layerId: 'base-control',
      x: 410, y: 0,  // NE  E=410, N=515
      label: 'CP-3 — NE Corner',
      phase: 'phase-0',
      elevation: 'N 515.0 / E 410.0',
      notes: 'NE property corner. Verify with survey before app calibration.',
      workerLabel: 'NE property corner',
      safetyFlag: 'none',
    },
    {
      id: 'CP-4',
      type: 'control_point',
      layerId: 'base-control',
      x: 410, y: 515,  // SE  E=410, N=0
      label: 'CP-4 — SE Corner',
      phase: 'phase-0',
      elevation: 'N 0.0 / E 410.0',
      notes: 'SE property corner. Verify with survey before app calibration.',
      workerLabel: 'SE property corner',
      safetyFlag: 'none',
    },

    // ── Phase 1 — Mobilization & Erosion Control ─────────────────────────────
    {
      id: 'SP-1',
      type: 'stockpile',
      layerId: 'esc',
      x: 350, y: 185,  // E=350, N=330
      label: 'SP-1 — Topsoil Stockpile',
      phase: 'phase-1',
      notes: 'Keep stabilized and outside drainage path. N 330.0, E 350.0.',
      workerLabel: 'Topsoil pile',
      safetyFlag: 'none',
    },
    {
      id: 'SP-2',
      type: 'stockpile',
      layerId: 'esc',
      x: 340, y: 423,  // E=340, N=92
      label: 'SP-2 — Import Fill Stockpile',
      phase: 'phase-1',
      notes: 'Do not place near trench edge. N 92.0, E 340.0.',
      workerLabel: 'Import fill pile',
      safetyFlag: 'none',
    },
    {
      id: 'CE-1',
      type: 'construction_entrance',
      layerId: 'esc',
      x: 106, y: 59,   // E=106, N=456
      label: 'CE-1 — Construction Entrance',
      phase: 'phase-1',
      notes: 'Stabilized rock entrance at north drive. N 456.0, E 86.0 to E 126.0.',
      workerLabel: 'Rock entrance',
      safetyFlag: 'none',
    },
    {
      id: 'CW-1',
      type: 'construction_entrance',
      layerId: 'esc',
      x: 348, y: 105,  // E=348, N=410
      label: 'CW-1 — Concrete Washout',
      phase: 'phase-1',
      notes: 'Away from storm inlets and flow paths. N 410.0, E 348.0.',
      workerLabel: 'Washout',
      safetyFlag: 'none',
    },

    // ── Phase 4 — Storm Drain & Infiltration ─────────────────────────────────
    {
      id: 'STM-MH-1',
      type: 'manhole',
      layerId: 'storm',
      x: 214, y: 65,   // E=214, N=450
      label: 'STM-MH-1 — Storm Overflow MH',
      phase: 'phase-4',
      system: 'storm',
      rimElevation: '96.80',
      invertIn: '91.80 (18-in in from STM-SMH-2)',
      invertOut: '91.40 (out to frontage overflow)',
      dropAcross: '0.40 ft',
      depth: '5.4 ft',
      pipeSlope: '0.50% to frontage',
      length: '62 ft to frontage tie-in',
      nearbyRef: 'North frontage — public overflow connection. E=214, N=450.',
      blueprintSheet: 'C3.10',
      notes: 'Storm manhole/overflow tie-in at north frontage. Confirm downstream connection before backfill.',
      workerLabel: 'Storm MH 1',
      safetyFlag: 'deep_5ft_plus',
      locationGuidance: 'Walk to the north frontage road. STM-MH-1 is at the center of the property, roughly in line with the main drive aisle, at the edge of the sidewalk/gutter. Look for survey stake marked STM-MH-1 set at E=214.',
      dimensions: {
        structureType: '48-in precast concrete, eccentric cone',
        diameter: '48 in',
        depth: '5.4 ft',
      },
      materials: {
        primary: '48-in ASTM C478 precast concrete',
        pipe: '18-in RCP Class III (out to frontage)',
        bedding: '4 in pea gravel min below base',
        backfill: 'Import select fill, 95% Modified Proctor',
      },
      connections: {
        upstream: ['STM-SMH-2'],
        downstream: [],
        laterals: [],
      },
      warnings: [
        'Depth 5.4 ft — cave-in protection required (trench box or sloping)',
        'Egress required: ladder or ramp within 25 ft',
        'Tie-in to public frontage storm — coordinate with City inspector before opening main',
        'Confirm downstream overflow capacity before connecting site storm system',
      ],
      detailRefs: ['DETAIL-STM-MH', 'DETAIL-TRENCH-BKFLL'],
      relatedObjectIds: ['STM-SMH-2', 'CB-1', 'CB-2'],
      checklist: [
        { id: 'stm-mh1-1', label: 'Pothole / verify frontage pipe invert before setting', phase: 'install' },
        { id: 'stm-mh1-2', label: 'Set base at correct invert — confirm with survey before pour', phase: 'install' },
        { id: 'stm-mh1-3', label: 'Barrel joints sealed — no gaps', phase: 'install' },
        { id: 'stm-mh1-4', label: 'Rim set to finish grade (not sub-grade)', phase: 'install' },
        { id: 'stm-mh1-5', label: 'Pipe connection grouted watertight at wall', phase: 'backfill' },
        { id: 'stm-mh1-6', label: 'Backfill in 8-in lifts, compacted before next lift', phase: 'backfill' },
        { id: 'stm-mh1-7', label: 'City inspector approve connection to public system', phase: 'inspect' },
        { id: 'stm-mh1-8', label: 'As-built rim elevation measured and recorded', phase: 'as-built' },
      ],
      fieldWorkflow: {
        preTask: [
          'Review sheet C3.10 — confirm pipe sizes, slopes, rim/invert elevations',
          'Verify downstream frontage overflow capacity with City',
          'Pothole existing frontage pipe — confirm invert before bidding final depth',
          'Have survey set offset stake before excavation',
        ],
        layout: [
          'Set offset from CP-2 (NW corner) — E=214, N=450',
          'Measure 214 ft east and 65 ft south from NW corner for center',
          'Mark cut line 2 ft larger than structure OD',
        ],
        excavation: [
          'Cut line saw-cut if in existing pavement',
          'Excavate 12 in below base elevation for bedding',
          'Install trench box — depth > 5 ft',
          'Place and compact 4 in pea gravel bedding',
        ],
        installation: [
          'Set precast base — check invert elevation before setting',
          'Set barrel sections — check plumb and alignment',
          'Grout pipe connections at wall (non-shrink grout)',
          'Set eccentric cone and frame',
          'Set rim to finish pavement grade — not subgrade',
        ],
        backfill: [
          'Backfill in 8-in lifts, hand-compact within 12 in of structure',
          'No pneumatic tampers within 12 in of structure wall',
          'Mechanical compaction permitted beyond 24 in from wall',
          'Proof-roll surface before any paving',
        ],
        testing: [
          'Visual inspection — no cracks, gaps, or open joints',
          'City inspector must sign off connection to public system',
        ],
        asBuilt: [
          'Survey as-built rim elevation',
          'Survey as-built invert in / invert out',
          'Record in as-built log',
        ],
      },
    },
    {
      id: 'STM-SMH-2',
      type: 'manhole',
      layerId: 'storm',
      x: 214, y: 125,  // E=214, N=390
      label: 'STM-SMH-2 — Sedimentation MH',
      phase: 'phase-4',
      rimElevation: '97.20',
      invertElevation: '92.20 (out)',
      depth: '5.0 ft',
      nearbyRef: 'Pretreatment before infiltration/water quality',
      blueprintSheet: 'C3.10',
      notes: 'Sedimentation manhole — protect from construction runoff during drywell installation.',
      workerLabel: 'Sediment MH',
      safetyFlag: 'deep_5ft_plus',
    },
    {
      id: 'STM-WQ-3',
      type: 'manhole',
      layerId: 'storm',
      x: 214, y: 179,  // E=214, N=336
      label: 'STM-WQ-3 — Water Quality MH',
      phase: 'phase-4',
      rimElevation: '97.70',
      invertElevation: '92.85 (out)',
      depth: '4.9 ft',
      nearbyRef: 'Additional treatment prior to drywell gallery',
      blueprintSheet: 'C3.10',
      notes: 'Water quality manhole. Inspect baffle/insert before accepting.',
      workerLabel: 'WQ MH',
      safetyFlag: 'egress_4ft_plus',
    },
    {
      id: 'DW-1',
      type: 'drywell',
      layerId: 'storm',
      x: 198, y: 203,  // E=198, N=312
      label: 'DW-1 — Drywell',
      phase: 'phase-4',
      rimElevation: '98.20',
      invertElevation: '86.20 (bottom)',
      depth: '12.0 ft',
      nearbyRef: 'Infiltration for parking runoff — protect from sediment until final stabilization',
      blueprintSheet: 'C3.10',
      notes: 'DEEP excavation 12 ft. Protective system required. Install last in storm sequence.',
      workerLabel: 'Drywell 1',
      safetyFlag: 'deep_5ft_plus',
    },
    {
      id: 'DW-2',
      type: 'drywell',
      layerId: 'storm',
      x: 214, y: 203,  // E=214, N=312
      label: 'DW-2 — Drywell',
      phase: 'phase-4',
      rimElevation: '98.20',
      invertElevation: '86.20 (bottom)',
      depth: '12.0 ft',
      nearbyRef: 'Redundant infiltration capacity',
      blueprintSheet: 'C3.10',
      notes: 'DEEP excavation 12 ft. Protective system required. Install last in storm sequence.',
      workerLabel: 'Drywell 2',
      safetyFlag: 'deep_5ft_plus',
    },
    {
      id: 'DW-3',
      type: 'drywell',
      layerId: 'storm',
      x: 230, y: 203,  // E=230, N=312
      label: 'DW-3 — Drywell',
      phase: 'phase-4',
      rimElevation: '98.20',
      invertElevation: '86.20 (bottom)',
      depth: '12.0 ft',
      nearbyRef: 'Distributed gallery',
      blueprintSheet: 'C3.10',
      notes: 'DEEP excavation 12 ft. Protective system required. Install last in storm sequence.',
      workerLabel: 'Drywell 3',
      safetyFlag: 'deep_5ft_plus',
    },
    {
      id: 'CB-1',
      type: 'catch_basin',
      layerId: 'storm',
      x: 110, y: 83,   // E=110, N=432
      label: 'CB-1 — Catch Basin',
      phase: 'phase-4',
      system: 'storm',
      rimElevation: '97.30',
      invertOut: '93.15 (out to STM-MH-1)',
      depth: '4.2 ft',
      pipeSlope: '0.80% to STM-MH-1',
      length: '108 ft to STM-MH-1',
      nearbyRef: 'West drive approach — captures runoff from north parking and drive aisle. E=110, N=432.',
      blueprintSheet: 'C3.00',
      notes: 'Curb inlet. Install after rough curb lines are staked. Grate must be flush with finished pavement.',
      workerLabel: 'CB 1',
      safetyFlag: 'egress_4ft_plus',
      locationGuidance: 'Face the west parking drive entry from the north. CB-1 is in the curb line, roughly 110 ft east and 83 ft south of the NW corner. Look for the curb inlet opening on the east face of the curb.',
      dimensions: {
        structureType: '24×36 in precast concrete curb inlet',
        width: '24 in × 36 in body',
        depth: '4.2 ft',
        pipeSize: '12-in outlet',
      },
      materials: {
        primary: 'Precast concrete body',
        pipe: '12-in PVC SDR-35 outlet to STM-MH-1',
        fitting: 'Curb opening: 2 ft × 6 in, combination grate',
        bedding: '4 in pea gravel under structure',
        backfill: 'Import select fill, 95% Modified Proctor',
      },
      connections: {
        upstream: [],
        downstream: ['STM-MH-1'],
        laterals: [],
      },
      warnings: [
        'Depth 4.2 ft — egress required (ladder or ramp within 25 ft)',
        'Grate elevation must match finish pavement grade exactly — set after final grade confirmed',
        'ESC inlet protection required until site is stabilized',
        'Do not obstruct curb opening during paving',
      ],
      detailRefs: ['DETAIL-CB-STD', 'DETAIL-TRENCH-BKFLL'],
      relatedObjectIds: ['STM-MH-1', 'CB-2', 'CRB-W1'],
      checklist: [
        { id: 'cb1-1', label: 'Install only after curb line is staked and elevation confirmed', phase: 'install' },
        { id: 'cb1-2', label: 'Set body at correct invert — check survey before pour', phase: 'install' },
        { id: 'cb1-3', label: 'Outlet pipe connected, joint tight', phase: 'install' },
        { id: 'cb1-4', label: 'Grate elevation matches finish pavement grade', phase: 'install' },
        { id: 'cb1-5', label: 'Curb opening oriented into flow', phase: 'install' },
        { id: 'cb1-6', label: 'ESC protection installed (filter fabric or sediment barrier)', phase: 'install' },
        { id: 'cb1-7', label: 'Sump clean — no sediment from construction', phase: 'inspect' },
        { id: 'cb1-8', label: 'As-built rim and invert recorded', phase: 'as-built' },
      ],
      fieldWorkflow: {
        preTask: [
          'Review C3.00 — confirm CB-1 outlet pipe size and slope to STM-MH-1',
          'Confirm final pavement grade elevation before setting grate',
          'Install after curb lines are staked — grate must match curb reveal',
        ],
        layout: [
          'Offset from NW corner: E=110, N=432 (y=83 on plan)',
          'Curb opening faces west — into approaching vehicle traffic flow',
        ],
        installation: [
          'Set precast body at correct invert',
          'Connect 12-in outlet pipe to STM-MH-1 at 0.80% slope',
          'Set combination grate flush with finish pavement',
          'Backfill around structure in lifts',
        ],
        testing: [
          'Flow test — confirm water drains through outlet freely',
          'Grate elevation check with level',
        ],
        asBuilt: [
          'Record rim and invert elevations',
          'Confirm outlet pipe slope as-built',
        ],
      },
    },
    {
      id: 'CB-2',
      type: 'catch_basin',
      layerId: 'storm',
      x: 188, y: 107,  // E=188, N=408
      label: 'CB-2 — Catch Basin',
      phase: 'phase-4',
      rimElevation: '97.10',
      invertElevation: '93.00 (out)',
      depth: '4.1 ft',
      nearbyRef: 'North parking low point',
      blueprintSheet: 'C3.00',
      notes: 'Curb inlet at parking lot low point.',
      workerLabel: 'CB 2',
      safetyFlag: 'egress_4ft_plus',
    },
    {
      id: 'CB-3',
      type: 'catch_basin',
      layerId: 'storm',
      x: 108, y: 165,  // E=108, N=350
      label: 'CB-3 — Catch Basin',
      phase: 'phase-4',
      rimElevation: '97.85',
      invertElevation: '93.75 (out)',
      depth: '4.1 ft',
      nearbyRef: 'West parking bay',
      blueprintSheet: 'C3.00',
      notes: 'Curb inlet. Verify grate orientation faces flow direction.',
      workerLabel: 'CB 3',
      safetyFlag: 'egress_4ft_plus',
    },
    {
      id: 'CB-4',
      type: 'catch_basin',
      layerId: 'storm',
      x: 162, y: 227,  // E=162, N=288
      label: 'CB-4 — Catch Basin',
      phase: 'phase-4',
      rimElevation: '98.40',
      invertElevation: '94.20 (out)',
      depth: '4.2 ft',
      nearbyRef: 'Central drive aisle',
      blueprintSheet: 'C3.00',
      notes: 'Area drain in drive aisle. Set lid flush with final pave grade.',
      workerLabel: 'CB 4',
      safetyFlag: 'egress_4ft_plus',
    },
    {
      id: 'CB-5',
      type: 'catch_basin',
      layerId: 'storm',
      x: 250, y: 277,  // E=250, N=238
      label: 'CB-5 — Catch Basin',
      phase: 'phase-4',
      rimElevation: '98.80',
      invertElevation: '94.65 (out)',
      depth: '4.2 ft',
      nearbyRef: 'East parking bay',
      blueprintSheet: 'C3.00',
      notes: 'Curb inlet at east parking low point.',
      workerLabel: 'CB 5',
      safetyFlag: 'egress_4ft_plus',
    },
    {
      id: 'CB-6',
      type: 'catch_basin',
      layerId: 'storm',
      x: 322, y: 341,  // E=322, N=174
      label: 'CB-6 — Catch Basin',
      phase: 'phase-4',
      rimElevation: '99.10',
      invertElevation: '94.95 (out)',
      depth: '4.2 ft',
      nearbyRef: 'Southeast pavement',
      blueprintSheet: 'C3.00',
      notes: 'Curb inlet at SE parking area. Confirm pipe slope to DW manifold ≥ 0.5%.',
      workerLabel: 'CB 6',
      safetyFlag: 'egress_4ft_plus',
    },

    // ── Phase 5 — Sanitary Sewer ─────────────────────────────────────────────
    {
      id: 'SAN-MH-1',
      type: 'manhole',
      layerId: 'sanitary',
      x: 58, y: 77,   // E=58, N=438
      label: 'SAN-MH-1 — Public Sewer MH',
      phase: 'phase-5',
      rimElevation: '96.90',
      invertElevation: '88.80 (out)',
      depth: '8.1 ft',
      nearbyRef: 'Tie-in to existing frontage sewer',
      blueprintSheet: 'C4.00',
      notes: 'Deepest sewer MH on site — 8.1 ft. Pothole existing main before setting. Coordinate shutdown with district.',
      workerLabel: 'San MH 1',
      safetyFlag: 'deep_5ft_plus',
    },
    {
      id: 'SAN-MH-2',
      type: 'manhole',
      layerId: 'sanitary',
      x: 70, y: 177,  // E=70, N=338
      label: 'SAN-MH-2 — Sanitary MH',
      phase: 'phase-5',
      rimElevation: '98.10',
      invertElevation: '90.40 (out)',
      depth: '7.7 ft',
      nearbyRef: 'Sewer main alignment bend and service junction',
      blueprintSheet: 'C4.00',
      notes: '48" precast MH at alignment bend. Set rim to finish grade, not subgrade.',
      workerLabel: 'San MH 2',
      safetyFlag: 'deep_5ft_plus',
    },
    {
      id: 'SAN-MH-3',
      type: 'manhole',
      layerId: 'sanitary',
      x: 92, y: 297,  // E=92, N=218
      label: 'SAN-MH-3 — Sanitary MH',
      phase: 'phase-5',
      system: 'sanitary',
      rimElevation: '99.30',
      invertIn: '92.75 (8-in in from SAN-MH-2)',
      invertOut: '92.35 (8-in out to SAN-MH-2 upstream)',
      dropAcross: '0.40 ft (drop MH — flush through not possible)',
      depth: '7.0 ft',
      pipeSlope: '0.42% to SAN-MH-2',
      length: '120 ft to SAN-MH-2',
      nearbyRef: 'Upstream sewer junction — retail and coffee laterals tie in here. E=92, N=218.',
      blueprintSheet: 'C4.00',
      notes: 'Upstream MH — retail (SS-CO-1, SS-CO-2) and coffee (SS-CO-3) laterals tie in here. Junction MH with drop.',
      workerLabel: 'San MH 3',
      safetyFlag: 'deep_5ft_plus',
      locationGuidance: 'From the west side of the retail building, walk south along the building face. SAN-MH-3 is approximately 2 ft off the building foundation at E=92, N=218. Look for survey stake or MH lid near the southwest building corner.',
      dimensions: {
        structureType: '48-in precast concrete, eccentric cone',
        diameter: '48 in',
        depth: '7.0 ft',
      },
      materials: {
        primary: '48-in ASTM C478 precast concrete',
        pipe: '8-in PVC SDR-35 gravity sewer',
        fitting: 'Flexible wye connectors for laterals',
        bedding: '6 in pea gravel below base',
        backfill: 'Import select fill, 95% Modified Proctor. Native clay prohibited within 12 in of pipe.',
      },
      connections: {
        upstream: ['SS-CO-1', 'SS-CO-2', 'SS-CO-3'],
        downstream: ['SAN-MH-2'],
        laterals: ['Retail building lateral (bays 1–3)', 'Retail building lateral (bays 4–6)', 'Coffee building lateral'],
      },
      warnings: [
        'DEEP MH — 7.0 ft depth requires full cave-in protection (trench box required)',
        'Confined space entry procedures apply — 4-gas monitor before entry',
        'Egress: ladder or ramp required within 25 ft',
        'Building laterals: do NOT backfill laterals until plumbing has been pressure-tested by building inspector',
        'Maintain 10-ft horizontal separation from water main — verify at this location (water main nearby at E=122)',
      ],
      detailRefs: ['DETAIL-SAN-MH', 'DETAIL-TRENCH-BKFLL'],
      relatedObjectIds: ['SAN-MH-2', 'SS-CO-1', 'SS-CO-2', 'SS-CO-3'],
      checklist: [
        { id: 'san-mh3-1', label: 'Pothole existing utility — confirm no conflicts at this location', phase: 'install' },
        { id: 'san-mh3-2', label: 'Survey offset stake set before excavation', phase: 'install' },
        { id: 'san-mh3-3', label: 'Trench box installed — depth 7 ft', phase: 'install' },
        { id: 'san-mh3-4', label: 'Base set at correct invert — surveyed before pour', phase: 'install' },
        { id: 'san-mh3-5', label: 'Invert channel formed — match pipe inverts', phase: 'install' },
        { id: 'san-mh3-6', label: 'All lateral connections grouted watertight', phase: 'install' },
        { id: 'san-mh3-7', label: 'Rim set to finish grade', phase: 'install' },
        { id: 'san-mh3-8', label: 'Backfill in 8-in lifts, compaction verified', phase: 'backfill' },
        { id: 'san-mh3-9', label: 'Air test or mandrel test on sewer main', phase: 'inspect' },
        { id: 'san-mh3-10', label: 'Building laterals pressure-tested by building inspector', phase: 'inspect' },
        { id: 'san-mh3-11', label: '10-ft separation from water main verified and documented', phase: 'inspect' },
        { id: 'san-mh3-12', label: 'As-built: rim, invert in, invert out, and lateral inverts recorded', phase: 'as-built' },
      ],
      fieldWorkflow: {
        preTask: [
          'Review C4.00 — confirm all lateral inverts and building service elevations',
          'Coordinate with plumbing contractor on lateral stub-out elevations',
          'Pothole for water main — maintain 10-ft min horizontal separation',
          'Get survey offset stake (MH is close to building foundation)',
        ],
        layout: [
          'Center at E=92, N=218 (x=92, y=297 on plan)',
          'Set building lateral stubs at correct elevation before backfilling around foundation',
          'Confirm 10-ft clearance to nearest water main (FIRE-1 at E=122)',
        ],
        excavation: [
          'Saw cut pavement if needed',
          'Install trench box — 7 ft depth',
          'Dewater as needed — lower water table at drywells during storm install',
          'Compact 6 in pea gravel bedding',
        ],
        installation: [
          'Set precast base — invert channel matches pipe (in = 92.75, out = 92.35)',
          'Set barrel sections — check plumb',
          'Grout lateral connections — watertight',
          'Set eccentric cone and frame — rim to finish grade 99.30',
          'Stub out building laterals per plumbing plans',
        ],
        backfill: [
          '8-in lifts, hand-compact within 12 in of structure',
          'Coordinate lateral backfill with plumbing inspection schedule',
          '95% Modified Proctor — import select fill',
        ],
        testing: [
          'Air test or low-pressure air test on main per ASTM F1417',
          'Mandrel test if required by district',
          'Building inspector to test laterals separately',
        ],
        asBuilt: [
          'Survey rim elevation',
          'Survey invert in and invert out',
          'Record all lateral stub-out elevations',
        ],
      },
    },
    {
      id: 'SS-CO-1',
      type: 'cleanout',
      layerId: 'sanitary',
      x: 150, y: 267,  // E=150, N=248
      label: 'SS-CO-1 — Retail Cleanout',
      phase: 'phase-5',
      invertElevation: '94.20',
      depth: '5.4 ft',
      nearbyRef: 'Retail tenant lateral (Bay 1–3)',
      blueprintSheet: 'C4.00',
      notes: 'Building cleanout outside footprint. Locate per plumbing coordination.',
      workerLabel: 'Cleanout 1',
      safetyFlag: 'deep_5ft_plus',
    },
    {
      id: 'SS-CO-2',
      type: 'cleanout',
      layerId: 'sanitary',
      x: 210, y: 267,  // E=210, N=248
      label: 'SS-CO-2 — Retail Cleanout',
      phase: 'phase-5',
      invertElevation: '94.45',
      depth: '5.3 ft',
      nearbyRef: 'Retail tenant lateral (Bay 4–6)',
      blueprintSheet: 'C4.00',
      notes: 'Building cleanout outside footprint.',
      workerLabel: 'Cleanout 2',
      safetyFlag: 'deep_5ft_plus',
    },
    {
      id: 'SS-CO-3',
      type: 'cleanout',
      layerId: 'sanitary',
      x: 282, y: 399,  // E=282, N=116
      label: 'SS-CO-3 — Coffee Cleanout',
      phase: 'phase-5',
      invertElevation: '93.80',
      depth: '5.3 ft',
      nearbyRef: 'Coffee building lateral',
      blueprintSheet: 'C4.00',
      notes: 'Coffee pad building lateral cleanout.',
      workerLabel: 'Coffee CO',
      safetyFlag: 'deep_5ft_plus',
    },

    // ── Phase 6 — Water, Fire & Domestic ─────────────────────────────────────
    {
      id: 'W-TAP-1',
      type: 'gate_valve',
      layerId: 'water',
      x: 74, y: 59,   // E=74, N=456
      label: 'W-TAP-1 — Water Main Tap (12×8-in Tee)',
      phase: 'phase-6',
      system: 'water',
      depth: '4.5 ft cover to existing main',
      elevation: 'Top of existing main ≈ 95.50 ft',
      nearbyRef: 'Existing 12-in public water main — north frontage. E=74, N=456.',
      blueprintSheet: 'C5.00',
      notes: 'Pothole existing main before tapping. Coordinate shutdown and disinfection with utility district. 12×8-in Tee, mechanical joint, with 8-in gate valve immediately downstream.',
      workerLabel: 'Water tap',
      safetyFlag: 'utility_conflict',
      locationGuidance: 'At the north frontage, 74 ft east of the NW corner. The existing 12-in main runs east-west in the frontage ROW. Pothole carefully — the main may shift up to 12 in from plan location.',
      dimensions: {
        structureType: '12×8-in Tee, mechanical joint DI',
        pipeSize: '8-in new site water main',
        depth: '4.5 ft cover to top of existing 12-in main',
      },
      materials: {
        primary: 'Ductile iron Class 52, polyethylene encased',
        pipe: '8-in DI C52 or PVC C900 DR-18',
        fitting: '12×8-in DI tee, mechanical joint with retainer glands',
        bedding: 'Pea gravel, 6 in below main, 6 in above',
        backfill: 'Import select fill, 95% Modified Proctor',
        tracer: '#12 AWG THHN blue, terminate at valve box',
      },
      connections: {
        upstream: [],
        downstream: ['W-V-1'],
        crossings: ['SAN-MH-1'],
      },
      warnings: [
        'UTILITY CONFLICT — verify existing utility locates before excavation',
        'Pothole required — DO NOT machine excavate near existing main without confirm depth/location',
        'Coordinate water shutdown with utility district — may require 48-hr notice',
        'Pressure test 150 PSI / 2 hours before any backfill on new main',
        'Disinfection required: flush, chlorinate (50 PPM), wait 24 hr, flush, test, accept',
        'No sewer within 10 ft horizontal / 18 in vertical of water main',
      ],
      detailRefs: ['DETAIL-WATER-TRENCH', 'DETAIL-TRENCH-BKFLL'],
      relatedObjectIds: ['W-V-1', 'FH-1', 'FIRE-1'],
      checklist: [
        { id: 'wtap1-1', label: 'Pothole existing 12-in main — confirm depth, size, and material', phase: 'install' },
        { id: 'wtap1-2', label: 'Utility locates called — 800-332-2344 (Oregon 811)', phase: 'install' },
        { id: 'wtap1-3', label: 'Shutdown/tap coordinated with utility district', phase: 'install' },
        { id: 'wtap1-4', label: 'Tee installed — restrained mechanical joint, PE encased', phase: 'install' },
        { id: 'wtap1-5', label: 'Tracer wire continuous and connected to valve box', phase: 'install' },
        { id: 'wtap1-6', label: 'Pressure test: 150 PSI / 2 hrs — no leaks', phase: 'inspect' },
        { id: 'wtap1-7', label: 'Chlorination and bacteriological clearance obtained', phase: 'inspect' },
        { id: 'wtap1-8', label: 'As-built location staked and recorded', phase: 'as-built' },
      ],
      fieldWorkflow: {
        preTask: [
          'Call 811 — utility locates required minimum 48 hours before excavation',
          'Review C5.00 — confirm tap location, pipe size, and valve spacing',
          'Schedule district inspector — they must be present for any tap on public main',
          'Pothole before any machine work near main',
        ],
        layout: [
          'Set offset stake at E=74, N=456 (N frontage)',
          'Confirm 10-ft clearance from SAN-MH-1',
        ],
        excavation: [
          'Hand dig last 18 in near existing main',
          'Expose full tee location — confirm pipe size and condition',
        ],
        installation: [
          'Install 12×8-in DI Tee, mechanical joint, retainer glands',
          'PE encasement on all DI fittings',
          '8-in gate valve immediately downstream of tee (W-V-1)',
          'Tracer wire on all new pipe — blue, #12 AWG',
        ],
        testing: [
          'Pressure test: 150 PSI / 2 hours',
          'Flush, chlorinate, hold 24 hrs',
          'Sample and lab clearance before backfill/service',
        ],
        asBuilt: [
          'Survey top of tap fitting',
          'Record tracer wire continuity test',
          'District record drawing submitted',
        ],
      },
    },
    {
      id: 'W-V-1',
      type: 'gate_valve',
      layerId: 'water',
      x: 74, y: 77,   // E=74, N=438
      label: 'W-V-1 — 8-inch Gate Valve',
      phase: 'phase-6',
      elevation: 'box at grade',
      nearbyRef: 'Isolation valve at site entrance',
      blueprintSheet: 'C5.00',
      notes: 'Set valve box flush with final paved surface. Mark with valve box riser if needed.',
      workerLabel: 'Water valve',
      safetyFlag: 'utility_conflict',
    },
    {
      id: 'FH-1',
      type: 'hydrant',
      layerId: 'water',
      x: 70, y: 139,  // E=70, N=376
      label: 'FH-1 — Fire Hydrant',
      phase: 'phase-6',
      nearbyRef: 'Retail frontage fire coverage',
      blueprintSheet: 'C5.00',
      notes: 'Bury per City standard. Confirm clearance from curb and sight-line to fire lane.',
      workerLabel: 'Hydrant 1',
      safetyFlag: 'utility_conflict',
    },
    {
      id: 'FH-2',
      type: 'hydrant',
      layerId: 'water',
      x: 332, y: 383,  // E=332, N=132
      label: 'FH-2 — Fire Hydrant',
      phase: 'phase-6',
      nearbyRef: 'East/south fire coverage',
      blueprintSheet: 'C5.00',
      notes: 'Bury per City standard. Located for east and south building coverage.',
      workerLabel: 'Hydrant 2',
      safetyFlag: 'utility_conflict',
    },
    {
      id: 'FIRE-1',
      type: 'fire_service',
      layerId: 'water',
      x: 122, y: 261,  // E=122, N=254
      label: 'FIRE-1 — Fire Service',
      phase: 'phase-6',
      depth: '4.5 ft cover',
      nearbyRef: 'Retail sprinkler service',
      blueprintSheet: 'C5.00',
      notes: '6-inch fire service to retail building. Pressure test in isolated section before tie-in.',
      workerLabel: 'Fire service',
      safetyFlag: 'utility_conflict',
    },
    {
      id: 'DOM-1',
      type: 'meter',
      layerId: 'water',
      x: 118, y: 245,  // E=118, N=270
      label: 'DOM-1 — Domestic Meter Vault',
      phase: 'phase-6',
      notes: 'Retail domestic water meter vault. Confirm vault depth and access with meter district before backfill.',
      workerLabel: 'Retail meter',
      safetyFlag: 'utility_conflict',
    },
    {
      id: 'DOM-2',
      type: 'meter',
      layerId: 'water',
      x: 258, y: 397,  // E=258, N=118
      label: 'DOM-2 — Coffee Domestic Meter',
      phase: 'phase-6',
      depth: '3.5 ft cover',
      nearbyRef: 'Coffee pad domestic water service',
      blueprintSheet: 'C5.00',
      notes: 'Coffee pad domestic meter. Smaller service — 1-inch typical.',
      workerLabel: 'Coffee meter',
      safetyFlag: 'utility_conflict',
    },

    // ── Phase 7 — Dry Utilities ───────────────────────────────────────────────
    {
      id: 'JUT-1',
      type: 'construction_entrance',
      layerId: 'dry-util',
      x: 356, y: 59,   // E=356, N=456
      label: 'JUT-1 — Joint Utility Trench Start',
      phase: 'phase-7',
      depth: '3.5 ft',
      nearbyRef: 'Franchise utility entry at north frontage',
      blueprintSheet: 'C6.00',
      notes: 'No storm swale or surface drainage facility over joint trench. Verify Bend franchise routing standards.',
      workerLabel: 'Joint trench',
      safetyFlag: 'utility_conflict',
    },
    {
      id: 'EV-1',
      type: 'vault',
      layerId: 'dry-util',
      x: 356, y: 105,  // E=356, N=410
      label: 'EV-1 — Electric Vault',
      phase: 'phase-7',
      nearbyRef: 'Pull point at north entrance',
      blueprintSheet: 'C6.00',
      notes: 'Coordinate vault excavation and clearance with power utility. As-built required.',
      workerLabel: 'Electric vault 1',
      safetyFlag: 'utility_conflict',
    },
    {
      id: 'TX-1',
      type: 'vault',
      layerId: 'dry-util',
      x: 356, y: 231,  // E=356, N=284
      label: 'TX-1 — Transformer Pad',
      phase: 'phase-7',
      nearbyRef: 'Retail electrical service transformer',
      blueprintSheet: 'C6.00',
      notes: 'Pad-mount transformer. Crushed-rock base — verify clearance envelope with utility before excavation.',
      workerLabel: 'Transformer',
      safetyFlag: 'utility_conflict',
    },
    {
      id: 'EV-2',
      type: 'vault',
      layerId: 'dry-util',
      x: 326, y: 337,  // E=326, N=178
      label: 'EV-2 — Electric Vault',
      phase: 'phase-7',
      nearbyRef: 'Feed coffee pad and lighting circuits',
      blueprintSheet: 'C6.00',
      notes: 'Second electric vault. As-built required before final paving.',
      workerLabel: 'Electric vault 2',
      safetyFlag: 'utility_conflict',
    },
    {
      id: 'COM-1',
      type: 'vault',
      layerId: 'dry-util',
      x: 340, y: 113,  // E=340, N=402
      label: 'COM-1 — Communication Vault',
      phase: 'phase-7',
      nearbyRef: 'Telecom pull point at north entrance',
      blueprintSheet: 'C6.00',
      notes: 'Telecom vault. Coordinate conduit routing and conduit spare count with carrier.',
      workerLabel: 'Comm vault 1',
      safetyFlag: 'utility_conflict',
    },
    {
      id: 'COM-2',
      type: 'vault',
      layerId: 'dry-util',
      x: 336, y: 267,  // E=336, N=248
      label: 'COM-2 — Communication Vault',
      phase: 'phase-7',
      nearbyRef: 'Building telecom service point',
      blueprintSheet: 'C6.00',
      notes: 'Building service comm vault. Leave pull tape in all conduits.',
      workerLabel: 'Comm vault 2',
      safetyFlag: 'utility_conflict',
    },
    {
      id: 'LP-1',
      type: 'light_pole',
      layerId: 'dry-util',
      x: 172, y: 129,  // E=172, N=386
      label: 'LP-1 — Light Pole Base',
      phase: 'phase-7',
      nearbyRef: 'Parking lot lighting — north field',
      blueprintSheet: 'C6.00',
      notes: 'Drilled pier base. Confirm conduit stub-out direction before pour.',
      workerLabel: 'Light pole 1',
      safetyFlag: 'none',
    },
    {
      id: 'LP-2',
      type: 'light_pole',
      layerId: 'dry-util',
      x: 268, y: 229,  // E=268, N=286
      label: 'LP-2 — Light Pole Base',
      phase: 'phase-7',
      nearbyRef: 'Parking lot lighting — central',
      blueprintSheet: 'C6.00',
      notes: 'Drilled pier base.',
      workerLabel: 'Light pole 2',
      safetyFlag: 'none',
    },
    {
      id: 'LP-3',
      type: 'light_pole',
      layerId: 'dry-util',
      x: 186, y: 347,  // E=186, N=168
      label: 'LP-3 — Light Pole Base',
      phase: 'phase-7',
      nearbyRef: 'Parking lot lighting — south field',
      blueprintSheet: 'C6.00',
      notes: 'Drilled pier base.',
      workerLabel: 'Light pole 3',
      safetyFlag: 'none',
    },

    // ── Phase 8 — Flatwork, Pads & Subgrade ──────────────────────────────────
    {
      id: 'PAD-R-1',
      type: 'building_pad',
      layerId: 'flatwork',
      x: 124, y: 293,  // E=124, N=222
      label: 'PAD-R-1 — Retail Pad SW',
      phase: 'phase-8',
      elevation: '98.50 (subgrade)',
      notes: 'Retail building pad SW corner. FF = 100.00. Trim subgrade to 98.50 before aggregate base.',
      workerLabel: 'Retail pad SW',
      safetyFlag: 'none',
    },
    {
      id: 'PAD-R-2',
      type: 'building_pad',
      layerId: 'flatwork',
      x: 286, y: 293,  // E=286, N=222
      label: 'PAD-R-2 — Retail Pad SE',
      phase: 'phase-8',
      elevation: '98.50 (subgrade)',
      notes: 'Retail building pad SE corner. FF = 100.00.',
      workerLabel: 'Retail pad SE',
      safetyFlag: 'none',
    },
    {
      id: 'PAD-R-3',
      type: 'building_pad',
      layerId: 'flatwork',
      x: 286, y: 205,  // E=286, N=310
      label: 'PAD-R-3 — Retail Pad NE',
      phase: 'phase-8',
      elevation: '98.50 (subgrade)',
      notes: 'Retail building pad NE corner. FF = 100.00.',
      workerLabel: 'Retail pad NE',
      safetyFlag: 'none',
    },
    {
      id: 'PAD-R-4',
      type: 'building_pad',
      layerId: 'flatwork',
      x: 124, y: 205,  // E=124, N=310
      label: 'PAD-R-4 — Retail Pad NW',
      phase: 'phase-8',
      elevation: '98.50 (subgrade)',
      notes: 'Retail building pad NW corner. FF = 100.00. Trim subgrade to 98.50 before aggregate base.',
      workerLabel: 'Retail pad NW',
      safetyFlag: 'none',
    },
    {
      id: 'PAD-C-1',
      type: 'building_pad',
      layerId: 'flatwork',
      x: 278, y: 399,  // E=278, N=116
      label: 'PAD-C-1 — Coffee Pad Center',
      phase: 'phase-8',
      elevation: '97.90 (subgrade)',
      notes: 'Coffee drive-through pad center. FF = 99.40. Trim subgrade to 97.90.',
      workerLabel: 'Coffee pad',
      safetyFlag: 'none',
    },
    {
      id: 'ADA-R1',
      type: 'ada_ramp',
      layerId: 'flatwork',
      x: 138, y: 59,   // E=138, N=456
      label: 'ADA-R1 — North Entry Ramp',
      phase: 'phase-8',
      notes: 'ADA ramp at north frontage entry. Match frontage grade. Confirm max 8.33% running slope, 2% cross-slope.',
      workerLabel: 'North ramp',
      safetyFlag: 'none',
    },
    {
      id: 'ADA-R2',
      type: 'ada_ramp',
      layerId: 'flatwork',
      x: 42, y: 133,   // E=42, N=382
      label: 'ADA-R2 — West Entry Ramp',
      phase: 'phase-8',
      notes: 'ADA ramp at west frontage entry. Match sidewalk grade. Confirm 2% max cross-slope.',
      workerLabel: 'West ramp',
      safetyFlag: 'none',
    },
    {
      id: 'TRASH-1',
      type: 'building_pad',
      layerId: 'flatwork',
      x: 356, y: 339,  // E=356, N=176
      label: 'TRASH-1 — Trash Enclosure Slab',
      phase: 'phase-8',
      elevation: '98.10 (subgrade)',
      notes: 'Service area slab prep. Confirm gate swing clearance and utility separation before pour.',
      workerLabel: 'Trash slab',
      safetyFlag: 'none',
    },

    // ── Phase 8 — Curb Lines ──────────────────────────────────────────────────
    // Curb reveal = 10 in above finished asphalt. Standard 6" face, 12" base.
    // Slope runs ~1% south to north (site drains north toward frontage).
    {
      id: 'CRB-N1',
      type: 'curb',
      layerId: 'flatwork',
      x: 120, y: 62,   // E=120, N=453 — north curb west half
      label: 'CRB-N1 — North Curb (West)',
      phase: 'phase-8',
      topElevation: '99.53',
      finishedGrade: '98.70',
      curbReveal: '10 in',
      slope: '0.5% E',
      subgradeElev: '97.28',
      rockThickness: '6 in',
      nearbyRef: 'North frontage entry drive — west half',
      blueprintSheet: 'C7.00',
      notes: 'Back of curb at property line. Match frontage road lip grade. Grade break at CP-2 corner.',
      workerLabel: 'N Curb W',
      safetyFlag: 'none',
    },
    {
      id: 'CRB-N2',
      type: 'curb',
      layerId: 'flatwork',
      x: 270, y: 62,   // E=270, N=453 — north curb east half
      label: 'CRB-N2 — North Curb (East)',
      phase: 'phase-8',
      topElevation: '99.46',
      finishedGrade: '98.63',
      curbReveal: '10 in',
      slope: '0.5% E',
      subgradeElev: '97.21',
      rockThickness: '6 in',
      nearbyRef: 'North frontage entry drive — east half',
      blueprintSheet: 'C7.00',
      notes: 'Matches east entry curb returns. Verify curb reveal at catch basin CB-1 location.',
      workerLabel: 'N Curb E',
      safetyFlag: 'none',
    },
    {
      id: 'CRB-W1',
      type: 'curb',
      layerId: 'flatwork',
      x: 92, y: 145,   // E=92, N=370 — west drive aisle curb mid-point
      label: 'CRB-W1 — West Drive Aisle Curb',
      phase: 'phase-8',
      topElevation: '99.78',
      finishedGrade: '98.95',
      curbReveal: '10 in',
      slope: '1.0% N',
      subgradeElev: '97.53',
      rockThickness: '8 in',
      nearbyRef: 'West drive aisle — between ADA-R2 and north entry',
      blueprintSheet: 'C7.00',
      notes: 'Curb transitions to ADA curb ramp at ADA-R2. 1% slope drains north to CB-1 gutter.',
      workerLabel: 'W Curb',
      safetyFlag: 'none',
    },
    {
      id: 'CRB-E1',
      type: 'curb',
      layerId: 'flatwork',
      x: 308, y: 185,  // E=308, N=330 — east parking curb mid-point
      label: 'CRB-E1 — East Parking Curb',
      phase: 'phase-8',
      topElevation: '99.38',
      finishedGrade: '98.55',
      curbReveal: '10 in',
      slope: '1.2% N',
      subgradeElev: '97.13',
      rockThickness: '8 in',
      nearbyRef: 'East parking bay — alongside CB-5 and CB-6 runs',
      blueprintSheet: 'C7.00',
      notes: 'Steeper 1.2% slope on east side drains north toward CB-2. Back of curb at parking island.',
      workerLabel: 'E Curb',
      safetyFlag: 'none',
    },
    {
      id: 'CRB-S1',
      type: 'curb',
      layerId: 'flatwork',
      x: 200, y: 318,  // E=200, N=197 — south cross-drive curb
      label: 'CRB-S1 — South Cross-Drive Curb',
      phase: 'phase-8',
      topElevation: '99.93',
      finishedGrade: '99.10',
      curbReveal: '10 in',
      slope: '0.8% W',
      subgradeElev: '97.68',
      rockThickness: '8 in',
      nearbyRef: 'South drive aisle between retail pad and coffee pad',
      blueprintSheet: 'C7.00',
      notes: '0.8% slope west directs sheet flow to west gutter/CB-4. Confirm grade matches coffee pad entry.',
      workerLabel: 'S Curb',
      safetyFlag: 'none',
    },

    // ── Phase 8 — Sidewalks ───────────────────────────────────────────────────
    // 4 in thick concrete, 6 ft wide. ADA cross-slope ≤ 2%, running ≤ 5%.
    {
      id: 'SWK-N1',
      type: 'sidewalk',
      layerId: 'flatwork',
      x: 200, y: 51,   // E=200, N=464 — north entry sidewalk center
      label: 'SWK-N1 — North Entry Sidewalk',
      phase: 'phase-8',
      topElevation: '99.28 → 99.00',
      finishedGrade: '98.70 (adj. asphalt)',
      slope: '0.5% E (running) / 1.5% S (cross)',
      concreteThickness: '4 in',
      width: '6 ft',
      subgradeElev: '98.95 → 98.67',
      rockThickness: '4 in',
      nearbyRef: 'Along north frontage, ADA-R1 to east entry',
      blueprintSheet: 'C7.00',
      notes: 'ADA compliant — confirm running slope ≤ 5%, cross-slope ≤ 2% at all points. Broom finish.',
      workerLabel: 'N Sidewalk',
      safetyFlag: 'none',
    },
    {
      id: 'SWK-W1',
      type: 'sidewalk',
      layerId: 'flatwork',
      x: 50, y: 185,   // E=50, N=330 — west building walk center
      label: 'SWK-W1 — West Building Sidewalk',
      phase: 'phase-8',
      topElevation: '99.50 → 99.10',
      finishedGrade: '98.95 (adj. asphalt)',
      slope: '1.0% N (running) / 1.0% E (cross)',
      concreteThickness: '4 in',
      width: '6 ft',
      subgradeElev: '99.17 → 98.77',
      rockThickness: '4 in',
      nearbyRef: 'Along west building face, ADA-R2 to north entry',
      blueprintSheet: 'C7.00',
      notes: 'Walk drains 1% toward parking lot on east side. Expansion joints every 10 ft. Broom finish.',
      workerLabel: 'W Sidewalk',
      safetyFlag: 'none',
    },

    // ── Phase 8 — Grade Breaks ────────────────────────────────────────────────
    {
      id: 'GB-1',
      type: 'grade_break',
      layerId: 'flatwork',
      x: 195, y: 135,  // E=195, N=380 — north parking high point
      label: 'GB-1 — North Parking High Point',
      phase: 'phase-8',
      topElevation: '99.00',
      finishedGrade: '99.00',
      slope: '1.5% → 0.5% (grade break, draining N)',
      gradeBreakType: 'high_point',
      nearbyRef: 'North parking row — midfield between LP-1 and storm trunk',
      blueprintSheet: 'C7.00',
      notes: 'High point crown — lot sheds 1.5% north of here, softens to 0.5% toward frontage.',
      workerLabel: 'HP-1',
      safetyFlag: 'none',
    },
    {
      id: 'GB-2',
      type: 'grade_break',
      layerId: 'flatwork',
      x: 248, y: 255,  // E=248, N=260 — central parking low point
      label: 'GB-2 — Central Parking Low Point',
      phase: 'phase-8',
      topElevation: '98.78',
      finishedGrade: '98.78',
      slope: '2.0% N / 1.5% S (low point, collects to CB-5)',
      gradeBreakType: 'low_point',
      nearbyRef: 'Central parking — low point draining to CB-5',
      blueprintSheet: 'C7.00',
      notes: 'Sump low point. Ponding check required here after subgrade proof-roll. CB-5 inlet within 20 ft.',
      workerLabel: 'LP-1',
      safetyFlag: 'none',
    },

    // ── Phase 8 — Parking Lot Pavement Zones ─────────────────────────────────
    // Each zone is a representative sample point — tap for the full surface stack.
    // Stack (top to bottom): asphalt → rock base → subgrade
    {
      id: 'PKG-N',
      type: 'parking_lot',
      layerId: 'flatwork',
      x: 190, y: 115,   // E=190, N=400 — north parking bay
      label: 'PKG-N — North Parking Bay',
      phase: 'phase-8',
      topElevation: '98.85',               // finish asphalt grade
      finishedGrade: '98.85',
      slope: '1.5% N',
      concreteThickness: '3 in AC (2 lifts)',
      rockThickness: '8 in — 3/4" crushed aggregate',
      subgradeElev: '98.27',
      nearbyRef: 'North parking bay — rows 1 & 2',
      blueprintSheet: 'C6.00',
      notes: 'Proof-roll subgrade before aggregate base. Geotextile fabric required over soft subgrade. 2-inch AC base lift + 1-inch AC wear course.',
      workerLabel: 'N Lot',
      safetyFlag: 'none',
    },
    {
      id: 'PKG-C',
      type: 'parking_lot',
      layerId: 'flatwork',
      x: 195, y: 210,   // E=195, N=305 — central parking
      label: 'PKG-C — Central Parking Field',
      phase: 'phase-8',
      topElevation: '98.90',
      finishedGrade: '98.90',
      slope: '1.0% N / 0.5% W',
      concreteThickness: '3 in AC (2 lifts)',
      rockThickness: '8 in — 3/4" crushed aggregate',
      subgradeElev: '98.32',
      nearbyRef: 'Central parking field — main lot between building and north bay',
      blueprintSheet: 'C6.00',
      notes: 'Bi-directional drainage — 1% north to CB-1/CB-2 row, 0.5% west to west gutter. Verify grades at GB-1 and GB-2 before paving.',
      workerLabel: 'C Lot',
      safetyFlag: 'none',
    },
    {
      id: 'PKG-E',
      type: 'parking_lot',
      layerId: 'flatwork',
      x: 345, y: 185,   // E=345, N=330 — east parking strip
      label: 'PKG-E — East Parking Strip',
      phase: 'phase-8',
      topElevation: '98.68',
      finishedGrade: '98.68',
      slope: '1.2% N',
      concreteThickness: '3 in AC (2 lifts)',
      rockThickness: '8 in — 3/4" crushed aggregate',
      subgradeElev: '98.10',
      nearbyRef: 'East parking strip — alongside east curb CRB-E1',
      blueprintSheet: 'C6.00',
      notes: 'East strip has tighter drainage corridor. Verify subgrade at 1.2% north to CB-2 before aggregate base.',
      workerLabel: 'E Lot',
      safetyFlag: 'none',
    },
    {
      id: 'PKG-DRIVE-W',
      type: 'parking_lot',
      layerId: 'flatwork',
      x: 91, y: 200,    // E=91, N=315 — west drive aisle
      label: 'PKG-DW — West Drive Aisle',
      phase: 'phase-8',
      topElevation: '98.95',
      finishedGrade: '98.95',
      slope: '1.0% N',
      concreteThickness: '4 in AC (heavy vehicle)',
      rockThickness: '10 in — 3/4" crushed aggregate',
      subgradeElev: '98.12',
      nearbyRef: 'West drive aisle — delivery and emergency access route',
      blueprintSheet: 'C6.00',
      notes: 'Heavy vehicle aisle — 4-inch AC and 10-inch base per geotech report. Garbage truck and delivery clearance. Drain 1% north to CB-1.',
      workerLabel: 'W Drive',
      safetyFlag: 'none',
    },
    {
      id: 'COFFEE-LOT',
      type: 'parking_lot',
      layerId: 'flatwork',
      x: 310, y: 390,   // E=310, N=125 — coffee pad parking
      label: 'COFFEE-LOT — Coffee Pad Parking',
      phase: 'phase-8',
      topElevation: '99.05',
      finishedGrade: '99.05',
      slope: '1.5% W',
      concreteThickness: '3 in AC (2 lifts)',
      rockThickness: '8 in — 3/4" crushed aggregate',
      subgradeElev: '98.47',
      nearbyRef: 'Coffee pad drive-through & parking — SE of site',
      blueprintSheet: 'C6.00',
      notes: 'High finish grade due to adjacent coffee pad FF=99.40. Match curb return grades at south drive entry. Drainage west to CB-6.',
      workerLabel: 'Coffee Lot',
      safetyFlag: 'none',
    },
  ],

  userLocation: { x: 205, y: 249 },  // E=205, N=266 — center of site
  userHeading: 0,
  calibrationPoints: [],
};

export const defaultSelectedObjectId = 'STM-MH-1';
