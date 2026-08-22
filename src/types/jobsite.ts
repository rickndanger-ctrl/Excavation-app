export type GpsCoord = { lat: number; lng: number };

export type Point = { x: number; y: number };

export type FeatureGeometry =
  | { type: 'Point'; coordinates: Point }
  | { type: 'LineString'; coordinates: Point[] }
  | { type: 'Polygon'; coordinates: Point[] };

export type ExcavationLayer = {
  id: string;
  name: string;
  color: string;
  defaultVisible: boolean;
};

export type UtilityLine = {
  id: string;
  layerId: string;
  label?: string;
  phase?: string;
  points: Point[];
  provenance?: BlueprintObject['provenance'];
};

export type SafetyFlag =
  | 'none'
  | 'egress_4ft_plus'
  | 'deep_5ft_plus'
  | 'utility_conflict';

/** Structured dimensions block used for pipes, structures, and flatwork. */
export type ObjectDimensions = {
  diameter?: string;        // structure or pipe diameter
  pipeSize?: string;        // nominal pipe size (e.g. "8-in")
  width?: string;
  depth?: string;
  length?: string;
  structureType?: string;   // e.g. "48-in precast", "36-in HDPE riser"
  wallThickness?: string;
  sdr?: string;             // SDR rating for HDPE/PVC
};

/** Material specifications block. */
export type ObjectMaterials = {
  primary?: string;         // main pipe/structure material (e.g. "SDR-35 PVC")
  pipe?: string;
  fitting?: string;
  bedding?: string;         // e.g. "3/4-in pea gravel, min 6 in below pipe"
  backfill?: string;        // e.g. "Imported select fill, 95% compaction"
  concrete?: string;        // e.g. "3000 PSI, Class A"
  compaction?: string;      // e.g. "95% modified Proctor"
  geotextile?: string;
  tracer?: string;          // tracer wire spec
};

/** Upstream / downstream connections and lateral tie-ins. */
export type ObjectConnections = {
  upstream?: string[];      // object IDs
  downstream?: string[];
  laterals?: string[];
  crossings?: string[];     // utility conflict IDs
};

/** Ordered field workflow steps shown in the Workflow tab. */
export type ObjectWorkflow = {
  preTask?: string[];
  layout?: string[];
  excavation?: string[];
  installation?: string[];
  backfill?: string[];
  testing?: string[];
  inspection?: string[];
  asBuilt?: string[];
};

/** Single checklist item — field crews check these off at install / inspection. */
export type ChecklistItem = {
  id: string;
  label: string;
  phase?: 'install' | 'backfill' | 'inspect' | 'as-built';
};

export type BlueprintObject = {
  id: string;
  type:
    | 'manhole'
    | 'catch_basin'
    | 'curb'
    | 'sidewalk'
    | 'grade_break'
    | 'parking_lot'
    | 'building_pad'
    | 'elevation'
    | 'property_corner'
    | 'slope_marker'
    | 'fdc'
    | 'vault'
    | 'drywell'
    | 'cleanout'
    | 'hydrant'
    | 'gate_valve'
    | 'meter'
    | 'fire_service'
    | 'light_pole'
    | 'stockpile'
    | 'control_point'
    | 'ada_ramp'
    | 'construction_entrance'
    | 'sanitary_pipe'
    | (string & {});
  layerId: string;
  x: number;
  y: number;
  label: string;
  phase?: string;
  geometry?: FeatureGeometry;
  fieldDetail?: Record<string, unknown>;

  // ── Basic elevations / geometry ──────────────────────────────────────────
  elevation?: string;
  verticalDatum?: string;
  rimElevation?: string;
  invertElevation?: string;   // single invert (use invertIn/invertOut for structures)
  invertIn?: string;          // invert of incoming pipe
  invertOut?: string;         // invert of outgoing pipe
  dropAcross?: string;        // elevation drop across structure (e.g. "0.10 ft")
  depth?: string;             // trench or structure depth
  pipeSlope?: string;         // slope of departing pipe
  length?: string;            // pipe run length

  // ── Flatwork / pavement ───────────────────────────────────────────────────
  finishedGrade?: string;
  topElevation?: string;
  curbReveal?: string;
  subgradeElev?: string;
  rockThickness?: string;
  concreteThickness?: string;
  width?: string;
  gradeBreakType?: 'high_point' | 'low_point' | 'change';

  // ── Extended field data ───────────────────────────────────────────────────
  system?: string;            // 'storm' | 'sanitary' | 'water' | 'fire' | 'dry-util' | 'flatwork'
  dimensions?: ObjectDimensions;
  materials?: ObjectMaterials;
  connections?: ObjectConnections;
  warnings?: string[];        // plain-language hazard strings
  checklist?: ChecklistItem[];
  inspectionItems?: string[];
  fieldWorkflow?: ObjectWorkflow;
  detailRefs?: string[];      // IDs in standardDetails data
  relatedObjectIds?: string[]; // IDs of connected objects
  locationGuidance?: string;  // "How to find it" plain-language note

  // ── Misc ──────────────────────────────────────────────────────────────────
  slope?: string;
  nearbyRef?: string;
  blueprintSheet?: string;
  notes?: string;
  safetyFlag?: SafetyFlag;
  workerLabel?: string;
  symbol?: 'sanitary-manhole' | 'sanitary-cleanout' | 'sanitary-pipe' | 'storm-manhole' | 'storm-catch-basin' | 'water-gate' | 'dry-light-bollard';
  labelPriority?: number;
  confidence?: 'high' | 'medium' | 'low';
  provenance?: {
    sourceSha256?: string;
    sheet?: string;
    pdfPage?: number;
    sourceItemIndexes?: number[];
    sourceText?: string[];
    extraction?: string;
    sourceIds?: string[];
    decisionIds?: string[];
    status: 'confirmed' | 'reference-derived' | 'reviewed_assumption' | 'generated' | 'unknown';
  };
};

export type ControlPoint = {
  id: string;
  label: string;
  planPoint: Point;
  gpsCoord?: GpsCoord;
};

export type JobsitePhase = {
  id: string;
  name: string;
  summary?: string;
};

export type PlanCalibrationSummary = {
  status: 'passed_product_qa';
  controlCount: number;
  checkCount: number;
  passedCheckCount: number;
  maximumAbsoluteErrorFt: number;
  maximumRelativeErrorPercent: number;
  controlRmsResidualFt: number;
  authority: string;
};

/** Field-tracked completion state for a single blueprint object, set by the crew on site. */
export type ObjectStatus = 'not_started' | 'in_progress' | 'done';

/** Sentinel phase id for the "Finished Site Overview" view, which shows every phase's work at once. */
export const OVERVIEW_PHASE_ID = '__overview__';

export type JobsitePackage = {
  id: string;
  projectName: string;
  schemaVersion?: string;
  canonicalModelVersion?: string;
  disclaimer?: string;
  planCalibration?: PlanCalibrationSummary;
  unavailable?: Array<Record<string, unknown>>;
  phases: JobsitePhase[];
  downloadedAt?: string;
  plan: {
    imageUrl: string;
    widthFt: number;
    heightFt: number;
  };
  layers: ExcavationLayer[];
  objects: BlueprintObject[];
  utilities: UtilityLine[];
  userLocation: Point;
  userHeading: number;
  calibrationPoints: ControlPoint[];
};

export type ForemanNote = {
  id: string;
  text: string;
  createdAt: string;
};

export type RockCalculatorInputs = {
  lengthFt: number;
  widthFt: number;
  depthFt: number;
};
