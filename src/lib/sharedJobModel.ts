import { OPS, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';

export type Point = { x: number; y: number };
export type WorldPoint = { easting: number; northing: number };

export type ReviewerControlPoint = {
  id: string;
  page: Point;
  world: WorldPoint;
};

export type PlanSheetSourceKind = 'vector-model' | 'raster-reference' | 'mixed-reference';

export type PlanSheetCatalogEntry = {
  pageNumber: number;
  sourceKind: PlanSheetSourceKind;
  vectorPathCount: number;
  nativeTextCount: number;
  imagePaintCount: number;
};

export type PlanSetAnalysis = {
  sheetCount: number;
  provenance: {
    fileName: string;
    creator: string | null;
    producer: string | null;
  };
  spatialSpine: {
    controlPage: 4;
    planPage: 14;
    roadProfilePage: 15;
    wallProfilePage: 30;
  };
  sheets: PlanSheetCatalogEntry[];
};

export type SurveyMonument = {
  id: string;
  northing: number;
  easting: number;
  elevation: number;
  stationFt: number;
  offsetFt: number;
};

export type SurveyControl = {
  crs: {
    horizontalReferenceFrame: string;
    coordinateSystem: string;
    verticalDatum: string;
    geoid: string;
    units: string;
    projectAdjustmentFactor: number;
  };
  monuments: SurveyMonument[];
};

const IMAGE_OPERATIONS = new Set<number>([
  OPS.paintImageMaskXObject,
  OPS.paintImageMaskXObjectGroup,
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageXObjectRepeat,
  OPS.paintSolidColorImageMask,
]);

export async function analyzeCompletePlanSet(
  document: PDFDocumentProxy,
  fileName: string,
): Promise<PlanSetAnalysis> {
  const sheets: PlanSheetCatalogEntry[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const [operators, text] = await Promise.all([page.getOperatorList(), page.getTextContent()]);
    let vectorPathCount = 0;
    let imagePaintCount = 0;
    for (const operation of operators.fnArray) {
      if (operation === OPS.constructPath) vectorPathCount += 1;
      if (IMAGE_OPERATIONS.has(operation)) imagePaintCount += 1;
    }
    const nativeTextCount = text.items.reduce(
      (count, item) => count + ('str' in item && item.str.trim().length > 0 ? 1 : 0),
      0,
    );
    const sourceKind: PlanSheetSourceKind = vectorPathCount === 0 && nativeTextCount === 0
      ? 'raster-reference'
      : imagePaintCount >= 10 && vectorPathCount < 1000
        ? 'mixed-reference'
        : 'vector-model';
    sheets.push({ pageNumber, sourceKind, vectorPathCount, nativeTextCount, imagePaintCount });
    page.cleanup();
  }
  const metadata = await document.getMetadata();
  const info = metadata.info as { Creator?: string; Producer?: string };
  return {
    sheetCount: document.numPages,
    provenance: {
      fileName,
      creator: info.Creator ?? null,
      producer: info.Producer ?? null,
    },
    spatialSpine: { controlPage: 4, planPage: 14, roadProfilePage: 15, wallProfilePage: 30 },
    sheets,
  };
}

function stationToFeet(value: string): number {
  const match = value.match(/(\d+)\+(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Invalid station: ${value}`);
  return Number(match[1]) * 100 + Number(match[2]);
}

export async function parseSurveyControl(page: PDFPageProxy): Promise<SurveyControl> {
  const text = await page.getTextContent();
  const items = text.items.flatMap((item) => {
    if (!('str' in item) || !item.str.trim()) return [];
    return [{ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }];
  });
  const sourceText = items.map((item) => item.text).join(' ').replace(/\s+/g, ' ');
  const requiredPhrases = [
    'NAD 83 (2011)(EPOCH 2010.0)',
    'SPC (3402 OH SOUTH)',
    'NAVD 88',
    'GEOID: 18',
    'UNITS ARE IN U.S. SURVEY FEET',
  ];
  for (const phrase of requiredPhrases) {
    if (!sourceText.toUpperCase().includes(phrase)) {
      throw new Error(`Survey-control page is missing ${phrase}.`);
    }
  }
  const adjustmentMatch = sourceText.match(/PROJECT ADJUSTMENT FACTOR:\s*([\d.]+)/i);
  if (!adjustmentMatch) throw new Error('Survey-control page is missing the project adjustment factor.');

  const header = (label: string) => {
    const item = items.find((candidate) => candidate.text === label);
    if (!item) throw new Error(`Survey-control table is missing ${label}.`);
    return item.x;
  };
  const columns = [
    { name: 'northing', x: header('NORTH (Y)') },
    { name: 'easting', x: header('EAST (X)') },
    { name: 'elevation', x: header('ELEVATION (Z)') },
    { name: 'station', x: header('STATION') },
    { name: 'offset', x: header('OFFSET') },
  ] as const;

  const monuments = ['100', '101', '102', '103'].map((id): SurveyMonument => {
    const idItem = items.find((item) => item.text === id && item.x < columns[0].x);
    if (!idItem) throw new Error(`Survey-control table is missing monument ${id}.`);
    const row = items.filter((item) => Math.abs(item.y - idItem.y) <= 2.2 && item.x > idItem.x);
    const byColumn = new Map<string, string>();
    for (const item of row) {
      const nearest = columns.reduce((best, column) => (
        Math.abs(column.x - item.x) < Math.abs(best.x - item.x) ? column : best
      ));
      if (!byColumn.has(nearest.name)) byColumn.set(nearest.name, item.text);
    }
    const value = (name: string) => {
      const result = byColumn.get(name);
      if (!result) throw new Error(`Monument ${id} is missing ${name}.`);
      return result;
    };
    const offset = value('offset');
    return {
      id,
      northing: Number(value('northing')),
      easting: Number(value('easting')),
      elevation: Number(value('elevation')),
      stationFt: stationToFeet(value('station')),
      offsetFt: Number(offset.match(/[\d.]+/)?.[0]) * (/LT/i.test(offset) ? -1 : 1),
    };
  });

  return {
    crs: {
      horizontalReferenceFrame: 'NAD 83 (2011) (EPOCH 2010.0)',
      coordinateSystem: 'SPC (3402 OH SOUTH)',
      verticalDatum: 'NAVD 88',
      geoid: '18',
      units: 'U.S. survey feet',
      projectAdjustmentFactor: Number(adjustmentMatch[1]),
    },
    monuments,
  };
}

export type StatePlaneFit = {
  rmsResidualFt: number;
  scaleFtPerPageUnit: number;
  rotationRadians: number;
  toWorld: (point: Point) => WorldPoint;
};

export function fitStatePlaneTransform(
  controls: ReviewerControlPoint[],
  maxResidualFt: number,
): StatePlaneFit {
  if (controls.length < 3) throw new Error('At least three reviewed control points are required.');
  const [first, second, third] = controls;
  const signedArea = (
    (second.page.x - first.page.x) * (third.page.y - first.page.y)
    - (second.page.y - first.page.y) * (third.page.x - first.page.x)
  );
  const extent = Math.max(
    Math.hypot(second.page.x - first.page.x, second.page.y - first.page.y),
    Math.hypot(third.page.x - first.page.x, third.page.y - first.page.y),
    1,
  );
  if (Math.abs(signedArea) / (extent * extent) < 1e-6) {
    throw new Error('Reviewed control is degenerate; choose non-collinear monument centers.');
  }

  const mean = controls.reduce(
    (sum, control) => ({
      x: sum.x + control.page.x / controls.length,
      y: sum.y + control.page.y / controls.length,
      easting: sum.easting + control.world.easting / controls.length,
      northing: sum.northing + control.world.northing / controls.length,
    }),
    { x: 0, y: 0, easting: 0, northing: 0 },
  );
  let denominator = 0;
  let aNumerator = 0;
  let bNumerator = 0;
  for (const control of controls) {
    const x = control.page.x - mean.x;
    const y = control.page.y - mean.y;
    const easting = control.world.easting - mean.easting;
    const northing = control.world.northing - mean.northing;
    denominator += x * x + y * y;
    aNumerator += x * easting + y * northing;
    bNumerator += x * northing - y * easting;
  }
  if (denominator < 1e-9) throw new Error('Reviewed control is degenerate.');
  const a = aNumerator / denominator;
  const b = bNumerator / denominator;
  const translateEasting = mean.easting - a * mean.x + b * mean.y;
  const translateNorthing = mean.northing - b * mean.x - a * mean.y;
  const toWorld = (point: Point): WorldPoint => ({
    easting: a * point.x - b * point.y + translateEasting,
    northing: b * point.x + a * point.y + translateNorthing,
  });
  const squaredError = controls.reduce((sum, control) => {
    const result = toWorld(control.page);
    return sum + (result.easting - control.world.easting) ** 2 + (result.northing - control.world.northing) ** 2;
  }, 0);
  const rmsResidualFt = Math.sqrt(squaredError / controls.length);
  if (!Number.isFinite(rmsResidualFt) || rmsResidualFt > maxResidualFt) {
    throw new Error(
      `Reviewed control residual ${rmsResidualFt.toFixed(3)} ft exceeds ${maxResidualFt.toFixed(3)} ft.`,
    );
  }
  return {
    rmsResidualFt,
    scaleFtPerPageUnit: Math.hypot(a, b),
    rotationRadians: Math.atan2(b, a),
    toWorld,
  };
}

export type ProfileCalibration = {
  kind: 'roadway' | 'wall';
  stationOriginFt: number;
  pageXOrigin: number;
  pointsPerStationFoot: number;
  stationTicks: Array<{ stationFt: number; pageX: number }>;
  grade: {
    begin: { stationFt: number; elevationFt: number };
    end: { stationFt: number; elevationFt: number };
  } | null;
};

function fitLinearAxis(points: Array<{ value: number; page: number }>): {
  valueOrigin: number;
  pageOrigin: number;
  pointsPerValue: number;
} {
  if (points.length < 2) throw new Error('At least two axis labels are required.');
  const valueOrigin = points.reduce((sum, point) => sum + point.value / points.length, 0);
  const pageOrigin = points.reduce((sum, point) => sum + point.page / points.length, 0);
  const numerator = points.reduce(
    (sum, point) => sum + (point.value - valueOrigin) * (point.page - pageOrigin),
    0,
  );
  const denominator = points.reduce(
    (sum, point) => sum + (point.value - valueOrigin) ** 2,
    0,
  );
  if (denominator < 1e-9) throw new Error('Profile station labels are degenerate.');
  return { valueOrigin, pageOrigin, pointsPerValue: numerator / denominator };
}

export async function calibrateProfilePage(
  page: PDFPageProxy,
  kind: 'roadway' | 'wall',
): Promise<ProfileCalibration> {
  const text = await page.getTextContent();
  const items = text.items.flatMap((item) => {
    if (!('str' in item) || !item.str.trim()) return [];
    return [{ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }];
  });
  const stationLabels = items.flatMap((item) => {
    if (kind === 'roadway' && /^\d{4}\+00$/.test(item.text)) {
      return [{ value: stationToFeet(item.text), page: item.x }];
    }
    if (kind === 'wall' && /^\d{4}$/.test(item.text)) {
      return [{ value: Number(item.text) * 100, page: item.x }];
    }
    return [];
  });
  const axis = fitLinearAxis(stationLabels);
  let grade: ProfileCalibration['grade'] = null;
  if (kind === 'roadway') {
    const gradeStations = items.filter((item) => /^STA\. \d+\+\d+(?:\.\d+)?$/.test(item.text));
    const elevations = items.filter((item) => /^ELEV\. \d+(?:\.\d+)?$/.test(item.text));
    const pairs = gradeStations.flatMap((station) => {
      const elevation = elevations.reduce<{ text: string; x: number; y: number } | null>((best, candidate) => {
        const distance = Math.hypot(candidate.x - station.x, candidate.y - station.y);
        if (distance > 70) return best;
        if (!best || distance < Math.hypot(best.x - station.x, best.y - station.y)) return candidate;
        return best;
      }, null);
      if (!elevation) return [];
      return [{
        stationFt: stationToFeet(station.text),
        elevationFt: Number(elevation.text.match(/(\d+(?:\.\d+)?)$/)?.[1]),
      }];
    }).sort((left, right) => left.stationFt - right.stationFt);
    if (pairs.length >= 2) grade = { begin: pairs[0], end: pairs.at(-1)! };
  }
  return {
    kind,
    stationOriginFt: axis.valueOrigin,
    pageXOrigin: axis.pageOrigin,
    pointsPerStationFoot: axis.pointsPerValue,
    stationTicks: stationLabels.map((label) => ({ stationFt: label.value, pageX: label.page })),
    grade,
  };
}

export type AlignmentAnchor = { stationFt: number; page: Point };

export type StationSlice = {
  coordinate: { stationFt: number; offsetFt: number; elevationFt: number | null };
  planPagePoint: Point;
  roadProfileX: number;
  wallProfileX: number;
  units: { station: 'U.S. survey feet'; elevationDatum: 'NAVD 88' };
};

function interpolateAlignment(stationFt: number, anchors: AlignmentAnchor[]): Point {
  const ordered = [...anchors].sort((left, right) => left.stationFt - right.stationFt);
  const exact = ordered.find((anchor) => anchor.stationFt === stationFt);
  if (exact) return { ...exact.page };
  const rightIndex = ordered.findIndex((anchor) => anchor.stationFt > stationFt);
  if (rightIndex <= 0) throw new Error('Selected station is outside the reviewed alignment.');
  const left = ordered[rightIndex - 1];
  const right = ordered[rightIndex];
  const ratio = (stationFt - left.stationFt) / (right.stationFt - left.stationFt);
  return {
    x: left.page.x + (right.page.x - left.page.x) * ratio,
    y: left.page.y + (right.page.y - left.page.y) * ratio,
  };
}

function profileX(stationFt: number, calibration: ProfileCalibration): number {
  const exact = calibration.stationTicks.find((tick) => tick.stationFt === stationFt);
  if (exact) return exact.pageX;
  return calibration.pageXOrigin
    + (stationFt - calibration.stationOriginFt) * calibration.pointsPerStationFoot;
}

export function buildStationSlice(input: {
  stationFt: number;
  alignment: AlignmentAnchor[];
  road: ProfileCalibration;
  wall: ProfileCalibration;
}): StationSlice {
  const grade = input.road.grade;
  const elevationFt = grade
    ? grade.begin.elevationFt
      + (input.stationFt - grade.begin.stationFt)
        / (grade.end.stationFt - grade.begin.stationFt)
        * (grade.end.elevationFt - grade.begin.elevationFt)
    : null;
  return {
    coordinate: { stationFt: input.stationFt, offsetFt: 0, elevationFt },
    planPagePoint: interpolateAlignment(input.stationFt, input.alignment),
    roadProfileX: profileX(input.stationFt, input.road),
    wallProfileX: profileX(input.stationFt, input.wall),
    units: { station: 'U.S. survey feet', elevationDatum: 'NAVD 88' },
  };
}
