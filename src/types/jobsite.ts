export type GpsCoord = { lat: number; lng: number };

export type Point = { x: number; y: number };

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
};

export type BlueprintObject = {
  id: string;
  type:
    | 'manhole'
    | 'catch_basin'
    | 'curb'
    | 'building_pad'
    | 'elevation'
    | 'property_corner'
    | 'slope_marker'
    | 'fdc'
    | 'vault';
  layerId: string;
  x: number;
  y: number;
  label: string;
  phase?: string;
  elevation?: string;
  depth?: string;
  slope?: string;
  nearbyRef?: string;
  blueprintSheet?: string;
  notes?: string;
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

/** Field-tracked completion state for a single blueprint object, set by the crew on site. */
export type ObjectStatus = 'not_started' | 'in_progress' | 'done';

/** Sentinel phase id for the "Finished Site Overview" view, which shows every phase's work at once. */
export const OVERVIEW_PHASE_ID = '__overview__';

export type JobsitePackage = {
  id: string;
  projectName: string;
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
