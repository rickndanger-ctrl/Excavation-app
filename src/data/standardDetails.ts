/**
 * Standard Detail Cards — Willow Creek Retail Center
 *
 * Based on common City of Beaverton / Oregon DOT standard details.
 * These are simplified field-reference summaries, NOT stamped drawings.
 * Always verify against the project-specific plan set before construction.
 */

export type StandardDetail = {
  id: string;
  title: string;
  drawingNumber: string;
  agency: string;
  /** Object types this detail applies to */
  appliesTo: string[];
  /** Two-sentence plain-language field summary */
  fieldSummary: string;
  keyDimensions: string[];
  materials: string[];
  warnings: string[];
  commonMistakes: string[];
};

export const STANDARD_DETAILS: StandardDetail[] = [
  {
    id: 'DETAIL-TRENCH-BKFLL',
    title: 'Trench Backfill, Bedding & Tracer Wire',
    drawingNumber: 'STD-500',
    agency: 'City of Beaverton / ODOT',
    appliesTo: ['manhole', 'catch_basin', 'cleanout', 'gate_valve', 'meter', 'drywell'],
    fieldSummary:
      'All gravity pipe trenches require properly graded bedding material placed and compacted before pipe is set. Tracer wire is required on all non-metallic pressure mains.',
    keyDimensions: [
      '6 in min bedding below pipe centerline',
      '12 in min cover over pipe before compaction begins',
      'Trench width: pipe OD + 12 in each side (min 24 in)',
      'Max lift thickness: 8 in loose, 6 in near utilities',
    ],
    materials: [
      'Bedding: 3/4-in pea gravel or clean crushed rock (3/8–3/4 in)',
      'Initial backfill: imported select fill or approved native (no rocks > 4 in)',
      'Final backfill: structural fill per geotech, 95% Modified Proctor',
      'Tracer wire: #12 AWG THHN insulated copper, yellow for gas / blue for water / orange for comm',
    ],
    warnings: [
      'Do NOT use native clay or expansive soils within 12 in of pipe',
      'Pneumatic tampers prohibited within 12 in of pipe — use hand compaction',
      'Tracer wire must extend to surface at all structures and valves',
    ],
    commonMistakes: [
      'Skipping or under-specifying bedding thickness — pipe sags and joints fail',
      'Backfilling before inspection approval',
      'Cutting tracer wire short of structure box',
      'Using oversized rock that bridges over pipe and transfers load',
    ],
  },

  {
    id: 'DETAIL-SAN-MH',
    title: 'Standard Sanitary Manhole (48-in Precast)',
    drawingNumber: 'SAN-101',
    agency: 'City of Beaverton',
    appliesTo: ['manhole'],
    fieldSummary:
      'Standard 48-in precast concrete sanitary manhole with eccentric cone top. Channel and bench must be formed to match pipe inverts. Frame and cover are set to finished grade.',
    keyDimensions: [
      '48-in ID precast concrete barrel (standard depth ≤ 12 ft)',
      '60-in ID base section with formed invert channel',
      'Eccentric cone: 48-in to 24-in opening',
      'Frame and cover: 24-in clear opening, H-20 traffic rated',
      'Wall thickness: 5 in min, per ASTM C478',
      'Step spacing: 12 in O.C., aluminum or cast iron',
    ],
    materials: [
      'Barrel: ASTM C478 precast concrete, 4000 PSI min',
      'Joints: rubber gasket per ASTM C443',
      'Frame/cover: cast iron, AASHTO M306, H-20 rated',
      'External coating: two coats bituminous waterproofing at joints',
      'Invert channel: formed or brick-and-mortar, smooth finish',
      'Bench: concrete, sloped 1:6 toward channel',
    ],
    warnings: [
      'Structure depths > 5 ft require cave-in protection during installation',
      'Never allow traffic over unsupported cover before backfill is complete',
      'Annular space between pipe and structure must be grouted watertight',
      'Verify invert elevation and slope before any concrete is poured',
    ],
    commonMistakes: [
      'Setting frame elevation without accounting for final AC pavement thickness',
      'Not forming channel to match pipe — creates turbulence and solids buildup',
      'Joints not aligned / gaskets not seated — infiltration failures',
      'Connecting pipe without flexible coupling — wall cracks when soil settles',
    ],
  },

  {
    id: 'DETAIL-STM-MH',
    title: 'Standard Storm Manhole / Junction Structure',
    drawingNumber: 'STM-201',
    agency: 'City of Beaverton',
    appliesTo: ['manhole'],
    fieldSummary:
      'Storm junction manholes use the same 48-in precast barrel but may have concentric or eccentric cones. Grate inlets are used where curb box inlets are not. Invert channels are open-bottom for storm (no bench required below water surface).',
    keyDimensions: [
      '48-in ID precast barrel (standard)',
      '60-in base with formed invert',
      'Grate: 24-in square locking grate, AASHTO H-20',
      'Min 12-in sump below lowest pipe invert',
    ],
    materials: [
      'Barrel: ASTM C478, 4000 PSI',
      'Grate: ductile iron, locking style in traffic areas',
      'External: bituminous waterproofing at all joints',
      'Pipe connections: flexible connectors or boot-type seals',
    ],
    warnings: [
      'Confined space entry procedures required for structures > 4 ft deep',
      'Silt buildup in sump — clean before final inspection',
      'Do not allow storm water runoff to enter structure during construction',
    ],
    commonMistakes: [
      'Not providing sump depth — grit immediately blocks outlet pipe',
      'Setting grate elevation too low — ponding at structure',
      'Connecting storm pipe with rigid joint — differential settlement cracks wall',
    ],
  },

  {
    id: 'DETAIL-CB-STD',
    title: 'Standard Catch Basin / Curb Inlet',
    drawingNumber: 'STM-210',
    agency: 'City of Beaverton',
    appliesTo: ['catch_basin'],
    fieldSummary:
      'Precast or cast-in-place catch basin with curb opening or area drain grate. Outlet pipe must slope minimum 0.5%. Sump provides sediment storage between cleanings.',
    keyDimensions: [
      'CB body: 24×36 in or 36×36 in (standard)',
      'Curb opening: 2 ft long × 6 in high (standard)',
      'Outlet pipe invert: min 12 in below grate/rim',
      'Min sump: 18 in below outlet invert',
      'Grate: recessed combination grate, H-20 rated',
    ],
    materials: [
      'Body: precast concrete or CIP, 3000 PSI',
      'Frame and grate: ductile iron, H-20 traffic rated',
      'Outlet pipe: 12-in PVC SDR-35 or 12-in RCP (per plan)',
      'Bedding: 4 in pea gravel under structure',
    ],
    warnings: [
      'Grate must be set exactly at finish pavement grade — sag or hump causes bypass',
      'ESC protection required at all inlets until site is stabilized',
      'Do not pave over or obstruct curb opening',
    ],
    commonMistakes: [
      'Setting CB before final pavement grade is established — wrong rim elevation',
      'Outlet pipe slope < 0.5% — sedimentation and plugging',
      'Not cleaning sump before final inspection',
      'Curb opening misaligned with flow direction',
    ],
  },

  {
    id: 'DETAIL-STREET-CUT',
    title: 'Street Cut & Pavement Patch (Existing Asphalt)',
    drawingNumber: 'STD-600',
    agency: 'City of Beaverton / Washington County',
    appliesTo: ['manhole', 'catch_basin', 'gate_valve', 'cleanout'],
    fieldSummary:
      'Any cut into existing public pavement requires saw cutting, full-depth patch to match existing section, and a seal coat. City inspector must approve before permanent patch.',
    keyDimensions: [
      'Saw cut: min 12 in beyond trench edge, full depth',
      'Patch width: wider of trench width + 24 in or full lane width',
      'Base rock: match existing (min 6 in Class B aggregate)',
      'AC patch: match existing depth (typ. 3 in base + 2 in wear = 5 in)',
      'Seal coat: full-width edge seal at cut line',
    ],
    materials: [
      'Class B aggregate base: per ODOT 2030 specs',
      'AC mix: Level 3 or per local standard',
      'Tack coat: SS-1H at all vertical faces',
      'Crack seal: hot-applied rubberized asphalt at all edges after patch cures',
    ],
    warnings: [
      'Temporary patch required within 24 hours of backfill in traffic lanes',
      'No cold patch allowed in bike lanes or intersection areas',
      'Inspect finished patch elevation — flush with adjacent pavement within 3/8 in',
    ],
    commonMistakes: [
      'Not saw cutting — ragged edges fail quickly under traffic',
      'Insufficient base compaction before AC — patch sinks',
      'Permanent patch before final backfill compaction is confirmed',
    ],
  },

  {
    id: 'DETAIL-CURB-GUTTER',
    title: 'Standard Curb & Gutter (Portland Curb)',
    drawingNumber: 'FW-301',
    agency: 'City of Beaverton',
    appliesTo: ['curb'],
    fieldSummary:
      'Portland (vertical face) curb with integral gutter. Curb face is 6 in; reveal above finished pavement is set by plan (10 in this project). Subgrade must be proof-rolled before pour.',
    keyDimensions: [
      'Curb face: 6 in (vertical)',
      'Back width: 24 in (12 in face + 12 in gutter)',
      'Gutter: 12 in width, 1/2-in reveal at pavement edge',
      'Concrete depth: 6 in uniform under gutter',
      'Aggregate base under curb: min 4 in',
    ],
    materials: [
      'Concrete: 3500 PSI Class A, air-entrained 4–7%',
      'Reinforcement: per structural plans (typ. none for standard curb)',
      'Base: 3/4-in minus crushed aggregate, compacted to 95%',
      'Curing: liquid curing compound or wet burlap min 7 days',
      'Expansion joints: every 20 ft, premolded filler',
      'Contraction joints: every 10 ft, 1/4 depth saw cut',
    ],
    warnings: [
      'Do not pour if ambient temp < 35°F without cold weather plan',
      'Proof-roll subgrade — soft spots must be corrected before pour',
      'Back-of-curb must be backfilled and compacted before adjacent AC paving',
    ],
    commonMistakes: [
      'Wrong reveal elevation — curb set too high or too low relative to finish pavement grade',
      'Insufficient cure time before traffic or paving — spalling',
      'No expansion joints — random cracking at grade breaks and entries',
      'Backfilling too early — displacing wet concrete',
    ],
  },

  {
    id: 'DETAIL-SWK-STD',
    title: 'Standard Sidewalk (4-in PCC, 6-ft Wide)',
    drawingNumber: 'FW-401',
    agency: 'City of Beaverton / ADA Compliance',
    appliesTo: ['sidewalk', 'ada_ramp'],
    fieldSummary:
      'ADA-compliant sidewalk, 4-in concrete over 4-in aggregate base. Running slope ≤ 5%, cross-slope ≤ 2%. Detectable warning surface at all curb ramps. Broom finish.',
    keyDimensions: [
      'Width: 6 ft min (8 ft at entries)',
      'Concrete: 4 in, or 6 in at driveways',
      'Aggregate base: 4 in min, 3/4-in minus crushed',
      'Running slope: ≤ 5% (check with 24-in level)',
      'Cross-slope: ≤ 2%',
      'Landing at top of ramp: 5×5 ft min, ≤ 2% all directions',
      'Detectable warning surface: 2-ft depth in direction of travel',
    ],
    materials: [
      'Concrete: 3500 PSI, air-entrained 4–7%',
      'Aggregate base: 3/4-in minus crushed aggregate',
      'Finish: medium broom (transverse, perpendicular to travel)',
      'Detectable warning: cast-in-place truncated domes, ADA color (brick red or yellow)',
      'Expansion joints: every 20 ft and at structures',
      'Contraction joints (tooled or sawed): every 5 ft',
    ],
    warnings: [
      'Contractor is responsible for ADA slope verification — check with digital level',
      'No cold joints — complete pour in one pass per section',
      'Protect from traffic and foot traffic min 24 hours (72 hours preferred)',
    ],
    commonMistakes: [
      'Cross-slope > 2% — ADA violation, requires removal and replacement',
      'Joints not cut before concrete sets — uncontrolled cracking',
      'Detectable warning surface wrong depth or omitted at ramp bottom',
      'Backfill at edges — pushed before adequate cure, cracked edges',
    ],
  },

  {
    id: 'DETAIL-WATER-TRENCH',
    title: 'Water Main Trench & Bedding',
    drawingNumber: 'W-501',
    agency: 'City of Beaverton / Tualatin Valley Water District',
    appliesTo: ['gate_valve', 'meter', 'fire_service', 'hydrant'],
    fieldSummary:
      'Water main in ductile iron or C900 PVC requires pea gravel bedding and imported structural fill. All ferrous fittings require polyethylene encasement. Pressure test 150 PSI / 2 hours before any backfill.',
    keyDimensions: [
      'Min cover: 36 in over pipe (42 in at crossings)',
      'Bedding: 6 in below pipe, extend 6 in above',
      'Trench width: pipe OD + 12 in each side',
      'Thrust blocks: at all bends, tees, reducers, dead ends',
      'Tracer wire: #12 AWG, blue, terminate at valve boxes',
    ],
    materials: [
      'Pipe: Ductile iron Class 52 or PVC C900, DR-18',
      'Bedding: pea gravel (3/8–3/4 in) or clean sand',
      'Backfill: structural fill 95% Modified Proctor to 1 ft over pipe, then native',
      'Fittings: DI or brass, restrained joint where required',
      'Thrust: cast-in-place concrete per detail thrust schedule',
      'PE encasement: 8-mil polyethylene on all DI pipe and fittings',
    ],
    warnings: [
      'No backfill until pressure test passed and approved by inspector',
      'Tracer wire required — continuity test at both ends before backfill',
      'Maintain 10-ft horizontal separation from sanitary sewer (18-in vertical min at crossings)',
      'Chlorination / flush required before any service connection',
    ],
    commonMistakes: [
      'Backfilling before pressure test — find leaks early',
      'Thrust block poured over poly wrap — blocks bond to soil',
      'Tracer wire not continuous — system cannot be located with electronic locator',
      'Shallow cover at road crossings — pipe failure under traffic load',
    ],
  },
];

/** Look up one or more detail cards by ID. Returns only found IDs. */
export function getDetailCards(ids: string[]): StandardDetail[] {
  return ids
    .map((id) => STANDARD_DETAILS.find((d) => d.id === id))
    .filter((d): d is StandardDetail => d !== undefined);
}
