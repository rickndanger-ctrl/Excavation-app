import type { BlueprintObject, FeatureGeometry, JobsitePackage, Point } from '../types/jobsite';

const SUPPORTED_SCHEMA = 'excavation-field-map.jobsite-package/v0.1.0';
const REQUIRED_DISCLAIMER = 'NOT FOR CONSTRUCTION';
const PROVENANCE = new Set(['confirmed', 'reference-derived', 'reviewed_assumption', 'generated', 'unknown']);

type UnknownRecord = Record<string, unknown> & {
  id?: string;
  label?: string;
  layerId?: string;
  type?: string;
  phase?: string;
  system?: string;
  x?: number;
  y?: number;
  coordinates?: unknown;
  fieldDetail?: Record<string, unknown>;
  provenance?: { status?: unknown; source_ids?: unknown; decision_ids?: unknown };
  schema_version?: string;
  canonical_model_version?: string;
  disclaimer?: string;
  projectName?: string;
  objects?: unknown[];
  linearFeatures?: unknown[];
  areas?: unknown[];
  surfaces?: unknown[];
  utilities?: unknown[];
  layers?: unknown[];
  phases?: unknown[];
  plan?: { widthFt?: number; heightFt?: number };
  unavailable?: Array<Record<string, unknown>>;
  userHeading?: number;
  geometryFeatureId?: string;
  fromNodeId?: string;
  toNodeId?: string;
  terminalFeatureId?: string | null;
  verticalDatum?: string;
};

function record(value: unknown, name: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as UnknownRecord;
}

function array(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}

function points(value: unknown, geometryType: 'LineString' | 'Polygon'): [number, number][] {
  if (!Array.isArray(value)) throw new Error(`${geometryType} coordinates must be an array`);
  const parsed = value.map((coordinate) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2 || !coordinate.slice(0, 2).every(Number.isFinite)) {
      throw new Error(`${geometryType} coordinates must contain finite x/y pairs`);
    }
    return [Number(coordinate[0]), Number(coordinate[1])] as [number, number];
  });
  if (geometryType === 'LineString' && parsed.length < 2) throw new Error('LineString requires at least two points');
  if (geometryType === 'Polygon') {
    if (parsed.length < 4) throw new Error('Polygon requires at least four coordinates');
    const first = parsed[0]; const last = parsed[parsed.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) throw new Error('Polygon ring must be closed');
  }
  return parsed;
}

function centroid(coordinates: Point[]): Point {
  const unique = coordinates.length > 1 && coordinates[0].x === coordinates.at(-1)?.x && coordinates[0].y === coordinates.at(-1)?.y
    ? coordinates.slice(0, -1) : coordinates;
  return unique.reduce((sum, point) => ({ x: sum.x + point.x / unique.length, y: sum.y + point.y / unique.length }), { x: 0, y: 0 });
}

function provenance(source: UnknownRecord) {
  const raw = source.provenance;
  const status = raw?.status;
  if (!raw || typeof status !== 'string' || !PROVENANCE.has(status)) throw new Error(`Invalid provenance status for ${source.id}`);
  return {
    status,
    sourceIds: Array.isArray(raw.source_ids) ? [...raw.source_ids] : [],
    decisionIds: Array.isArray(raw.decision_ids) ? [...raw.decision_ids] : [],
  } as NonNullable<BlueprintObject['provenance']>;
}

function formatValue(value: unknown): string | undefined {
  return typeof value === 'number' ? String(value) : typeof value === 'string' ? value : undefined;
}

function consumerLayerId(source: UnknownRecord): string {
  if (source.layerId === 'site') return 'finished-site';
  if (source.layerId !== 'water') return source.layerId!;
  if (source.id?.includes('public-main') || source.id?.includes('reference-main')) return 'water-reference';
  if (source.system === 'domestic_water' || source.id?.startsWith('domestic-water-')) return 'domestic-water';
  if (source.system === 'fire_water' || source.id?.startsWith('fire-')) return 'fire-water';
  return 'water-reference';
}

function consumerLayers(sourceLayers: unknown[]): JobsitePackage['layers'] {
  return sourceLayers.flatMap((value) => {
    const layer = record(value, 'layer');
    if (layer.id === 'water') return [
      { id: 'domestic-water', name: 'Domestic Water', color: '#16a34a', defaultVisible: true },
      { id: 'fire-water', name: 'Fire Water', color: '#dc2626', defaultVisible: true },
      { id: 'water-reference', name: 'Water Source Reference', color: '#0f766e', defaultVisible: true },
    ];
    const names: Record<string, string> = {
      property: 'Property / Constraints',
      sanitary: 'Sanitary Sewer',
      storm: 'Storm / Roof Drainage',
    };
    return [{
      id: layer.id === 'site' ? 'finished-site' : layer.id!,
      name: layer.id === 'site' ? 'Finished Job Layout' : names[layer.id!] ?? String(layer.name),
      color: String(layer.color),
      defaultVisible: layer.defaultVisible !== false,
    }];
  });
}

function finiteDetail(detail: Record<string, unknown>, key: string, featureId: string): number {
  const value = detail[key];
  if (!Number.isFinite(value)) throw new Error(`${featureId} requires finite ${key} datum provenance.`);
  return Number(value);
}

function validateGradingContract(
  sourceObjects: UnknownRecord[],
  sourceLines: UnknownRecord[],
  sourceAreas: UnknownRecord[],
  sourceSurfaces: UnknownRecord[],
): void {
  const all = [...sourceObjects, ...sourceLines, ...sourceAreas, ...sourceSurfaces];
  const workflowTypes = new Set([
    'proposed_grade_surface', 'building_subgrade_surface', 'proposed_contour',
    'grade_break', 'spot_elevation', 'grading_limit', 'earthwork_fill_area',
    'earthwork_cut_area', 'surface_drainage_arrow',
  ]);
  const hasGradingWorkflow = all.some(
    (feature) => feature.layerId === 'grading' && workflowTypes.has(String(feature.type)),
  );
  const existingGround = sourceSurfaces.find((feature) => feature.id === 'surface-existing-grade-reference');
  if (!hasGradingWorkflow && !existingGround) return;
  if (!existingGround) throw new Error('Proposed grading requires a validated existing-ground datum basis.');

  const surfaceDetail = existingGround.fieldDetail ?? {};
  if (existingGround.verticalDatum !== 'NAVD88') throw new Error(`${existingGround.id} requires verticalDatum NAVD88.`);
  if (surfaceDetail.source_vertical_datum !== 'NGVD29') throw new Error(`${existingGround.id} requires source_vertical_datum NGVD29.`);
  if (surfaceDetail.model_vertical_datum !== 'NAVD88') throw new Error(`${existingGround.id} requires model_vertical_datum NAVD88.`);
  const verticalShiftFt = finiteDetail(surfaceDetail, 'vertical_shift_ft', existingGround.id!);
  finiteDetail(surfaceDetail, 'vertical_conversion_uncertainty_ft', existingGround.id!);
  const sourceIds = existingGround.provenance?.source_ids;
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    throw new Error(`${existingGround.id} requires source_ids datum provenance.`);
  }

  const contourIds = surfaceDetail.contour_ids;
  if (!Array.isArray(contourIds) || contourIds.length === 0) throw new Error(`${existingGround.id} requires contour_ids.`);
  const linesById = new Map(sourceLines.map((feature) => [feature.id, feature]));
  for (const contourId of contourIds) {
    const contour = linesById.get(String(contourId));
    if (!contour) throw new Error(`${existingGround.id} references missing contour ${contourId}.`);
    const detail = contour.fieldDetail ?? {};
    if (detail.source_vertical_datum !== 'NGVD29') throw new Error(`${contour.id} requires source_vertical_datum NGVD29.`);
    if (detail.model_vertical_datum !== 'NAVD88') throw new Error(`${contour.id} requires model_vertical_datum NAVD88.`);
    const sourceElevationFt = finiteDetail(detail, 'source_elevation_ft', contour.id!);
    const modelElevationFt = finiteDetail(detail, 'elevation_ft', contour.id!);
    const contourShiftFt = finiteDetail(detail, 'vertical_shift_ft', contour.id!);
    if (Math.abs(contourShiftFt - verticalShiftFt) > 0.0005
      || Math.abs(sourceElevationFt + contourShiftFt - modelElevationFt) > 0.0005) {
      throw new Error(`${contour.id} source and model elevations do not match its datum shift.`);
    }
    if (detail.source_surface_id !== existingGround.id) throw new Error(`${contour.id} must reference ${existingGround.id}.`);
  }

  for (const feature of sourceAreas.filter(
    (item) => item.type === 'earthwork_fill_area' || item.type === 'earthwork_cut_area',
  )) {
    const detail = feature.fieldDetail ?? {};
    const areaSf = finiteDetail(detail, 'area_sf', feature.id!);
    const averageDepthFt = finiteDetail(detail, 'average_depth_ft', feature.id!);
    const volumeCy = finiteDetail(detail, 'volume_cy', feature.id!);
    if (detail.quantity_status !== 'screening_only') throw new Error(`${feature.id} quantity_status must be screening_only.`);
    if (Math.abs(areaSf * averageDepthFt / 27 - volumeCy) > 0.01) {
      throw new Error(`${feature.id} volume_cy does not match area_sf × average_depth_ft / 27.`);
    }
  }

  for (const feature of sourceLines.filter((item) => item.type === 'surface_drainage_arrow')) {
    const detail = feature.fieldDetail ?? {};
    if (detail.downhill !== true) throw new Error(`${feature.id} requires an explicit downhill=true validation.`);
    if (typeof detail.hydraulic_capacity_status !== 'string') {
      throw new Error(`${feature.id} requires hydraulic_capacity_status.`);
    }
  }
}

function toObject(source: UnknownRecord, geometry: FeatureGeometry, center: Point, utility?: UnknownRecord): BlueprintObject {
  if (!source.id || !source.label || !source.layerId || !source.type) throw new Error('Every semantic feature requires id, label, layerId, and type');
  const detail = { ...(source.fieldDetail ?? {}), ...(utility?.fieldDetail ?? {}) };
  const detailMaterials = detail.materials && typeof detail.materials === 'object' && !Array.isArray(detail.materials)
    ? detail.materials as Record<string, unknown> : {};
  const unavailable = detail.unavailable && typeof detail.unavailable === 'object' && !Array.isArray(detail.unavailable)
    ? detail.unavailable as Record<string, unknown> : {};
  const warnings = Array.isArray(detail.warnings) ? detail.warnings.filter((item: unknown): item is string => typeof item === 'string') : undefined;
  const checklist = Array.isArray(detail.checklist) ? detail.checklist.filter((item: unknown): item is string => typeof item === 'string').map((label: string, index: number) => ({ id: `${source.id}-check-${index + 1}`, label })) : undefined;
  return {
    id: source.id,
    type: source.type,
    layerId: consumerLayerId(source),
    x: center.x,
    y: center.y,
    label: source.label,
    workerLabel: source.label,
    phase: source.phase,
    system: source.system ?? utility?.system,
    geometry,
    fieldDetail: detail,
    provenance: provenance(source),
    warnings,
    checklist,
    dimensions: {
      pipeSize: detail.diameter_in != null ? `${detail.diameter_in}-in` : undefined,
      length: detail.length_ft != null ? `${detail.length_ft} ft` : undefined,
      sdr: formatValue(detail.sdr),
      structureType: formatValue(detail.structure_type),
    },
    materials: {
      primary: formatValue(detail.material),
      bedding: formatValue(detailMaterials.bedding),
      backfill: formatValue(detailMaterials.backfill),
      compaction: formatValue(detailMaterials.compaction),
    },
    connections: {
      upstream: utility?.fromNodeId ? [utility.fromNodeId] : undefined,
      downstream: utility?.toNodeId ? [utility.toNodeId.replace('san-node-', 'sanitary-').replace('-01', '-01')] : undefined,
    },
    elevation: formatValue(detail.elevation_ft),
    verticalDatum: formatValue(source.verticalDatum ?? detail.vertical_datum ?? detail.model_vertical_datum),
    rimElevation: formatValue(detail.rim_elevation_ft),
    invertIn: formatValue(detail.invert_in_ft ?? detail.upstream_invert_ft),
    invertOut: formatValue(detail.invert_out_ft ?? detail.downstream_invert_ft),
    pipeSlope: detail.slope_percent != null ? `${detail.slope_percent}%` : undefined,
    length: detail.length_ft != null ? `${detail.length_ft} ft` : undefined,
    notes: Object.keys(unavailable).length > 0 ? `Unavailable: ${Object.values(unavailable).join(' ')}` : undefined,
  };
}

export function parseSemanticJobsiteManifest(input: unknown): JobsitePackage {
  const source = record(input, 'semantic manifest');
  if (source.schema_version !== SUPPORTED_SCHEMA) throw new Error(`Unsupported schema version: ${source.schema_version ?? 'missing'}`);
  if (typeof source.disclaimer !== 'string' || !source.disclaimer.includes(REQUIRED_DISCLAIMER)) throw new Error('Semantic package must be marked NOT FOR CONSTRUCTION');
  const sourceObjects = array(source.objects, 'objects').map((item) => record(item, 'point feature'));
  const sourceLines = array(source.linearFeatures, 'linearFeatures').map((item) => record(item, 'line feature'));
  const sourceAreas = array(source.areas, 'areas').map((item) => record(item, 'area feature'));
  const sourceSurfaces = (source.surfaces === undefined ? [] : array(source.surfaces, 'surfaces'))
    .map((item) => record(item, 'surface'));
  const sourceLayers = array(source.layers, 'layers');
  const sourcePhases = array(source.phases, 'phases');
  if (!source.plan || !Number.isFinite(source.plan.widthFt) || !Number.isFinite(source.plan.heightFt)) throw new Error('plan requires finite widthFt and heightFt');

  validateGradingContract(sourceObjects, sourceLines, sourceAreas, sourceSurfaces);

  const rawFeatures = [
    ...sourceObjects.map((source) => ({ source, kind: 'Point' as const })),
    ...sourceLines.map((source) => ({ source, kind: 'LineString' as const })),
    ...sourceAreas.map((source) => ({ source, kind: 'Polygon' as const })),
    ...sourceSurfaces.map((source) => ({ source, kind: 'Polygon' as const })),
  ];
  const ids = new Set<string>();
  for (const feature of rawFeatures) {
    if (typeof feature.source.id !== 'string') throw new Error('Every semantic feature requires an ID');
    if (ids.has(feature.source.id)) throw new Error(`Duplicate feature ID: ${feature.source.id}`);
    ids.add(feature.source.id);
  }

  const world = rawFeatures.flatMap(({ source: feature, kind }) => kind === 'Point' ? [[feature.x, feature.y] as [number, number]] : points(feature.coordinates, kind));
  if (world.length === 0) throw new Error('Semantic package contains no geometry');
  const minX = Math.min(...world.map(([x]) => x));
  const maxY = Math.max(...world.map(([, y]) => y));
  const toPlan = ([x, y]: [number, number]): Point => ({ x: x - minX, y: maxY - y });
  const utilitiesByGeometry = new Map((source.utilities ?? []).map((item: unknown) => {
    const utility = record(item, 'utility');
    return [utility.geometryFeatureId, utility];
  }));
  const objects = rawFeatures.map(({ source: feature, kind }) => {
    let geometry: FeatureGeometry;
    let center: Point;
    if (kind === 'Point') {
      const x = feature.x; const y = feature.y;
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Point ${feature.id} requires finite x/y coordinates`);
      center = toPlan([x!, y!]);
      geometry = { type: 'Point', coordinates: center };
    } else {
      const coordinates = points(feature.coordinates, kind).map(toPlan);
      geometry = { type: kind, coordinates };
      center = centroid(coordinates);
    }
    return toObject(feature, geometry, center, utilitiesByGeometry.get(feature.id));
  });

  return {
    id: source.id!,
    projectName: source.projectName!,
    schemaVersion: source.schema_version,
    canonicalModelVersion: source.canonical_model_version,
    disclaimer: source.disclaimer,
    unavailable: structuredClone(source.unavailable ?? []),
    phases: structuredClone(sourcePhases) as JobsitePackage['phases'],
    layers: consumerLayers(sourceLayers),
    plan: { imageUrl: '', widthFt: source.plan.widthFt!, heightFt: source.plan.heightFt! },
    objects,
    utilities: [],
    userLocation: { x: source.plan.widthFt! / 2, y: source.plan.heightFt! / 2 },
    userHeading: Number(source.userHeading ?? 0),
    calibrationPoints: [],
  };
}
