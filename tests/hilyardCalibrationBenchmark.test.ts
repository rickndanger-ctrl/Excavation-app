import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const FACTORY_OUTPUT = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-grading-site-prep';

type PagePoint = { x: number; y: number };
type ReviewerControlPoint = {
  id: string;
  page: PagePoint;
  world: { easting: number; northing: number };
};
type GeometryMarker = {
  id: string;
  geometry_type: string;
  page_coordinates: number[][];
};

type Benchmark = {
  visible_controls: Array<{ id: string; coordinates: [number, number] }>;
  acceptance: {
    maximum_absolute_error_ft: number;
    maximum_relative_error_percent: number;
  };
  sealed_checks: Array<{
    id: string;
    label: string;
    expected_distance_ft: number;
    pdf_geometry_refs: {
      start: { feature_id: string; vertex_index: number };
      end: { feature_id: string; vertex_index: number };
    };
  }>;
};

function readFirstSheetGeometry(): Map<string, GeometryMarker> {
  const bytes = fs.readFileSync(`${FACTORY_OUTPUT}/hilyard-site-layout.pdf`);
  const text = bytes.toString('latin1');
  const markers = new Map<string, GeometryMarker>();
  for (const match of text.matchAll(/%MS_GEOM ([A-Za-z0-9+/=]+)/g)) {
    const marker = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')) as GeometryMarker;
    if (!markers.has(marker.id)) markers.set(marker.id, marker);
  }
  return markers;
}

function vertex(markers: Map<string, GeometryMarker>, ref: { feature_id: string; vertex_index: number }): PagePoint {
  const point = markers.get(ref.feature_id)?.page_coordinates[ref.vertex_index];
  assert.ok(point, `Missing PDF geometry ${ref.feature_id}[${ref.vertex_index}]`);
  return { x: point[0], y: point[1] };
}

test('calibrates the actual Hilyard plan sheet and recovers all sealed distances', async () => {
  Object.assign(globalThis, { DOMMatrix: class DOMMatrix {} });
  const { evaluateDistanceCalibration, fitStatePlaneTransform } = await import('../src/lib/sharedJobModel');
  const benchmark = JSON.parse(
    fs.readFileSync(`${FACTORY_OUTPUT}/calibration-benchmark.json`, 'utf8'),
  ) as Benchmark;
  const markers = readFirstSheetGeometry();
  const site = markers.get('property-site-boundary');
  assert.ok(site);

  const controls: ReviewerControlPoint[] = benchmark.visible_controls.map((control, index) => ({
    id: control.id,
    page: {
      x: site.page_coordinates[index][0],
      y: site.page_coordinates[index][1],
    },
    world: { easting: control.coordinates[0], northing: control.coordinates[1] },
  }));
  const fit = fitStatePlaneTransform(controls, 0.25);
  const report = evaluateDistanceCalibration(
    fit,
    benchmark.sealed_checks.map((check) => ({
      id: check.id,
      label: check.label,
      start: vertex(markers, check.pdf_geometry_refs.start),
      end: vertex(markers, check.pdf_geometry_refs.end),
      expectedDistanceFt: check.expected_distance_ft,
    })),
    {
      maximumAbsoluteErrorFt: benchmark.acceptance.maximum_absolute_error_ft,
      maximumRelativeErrorPercent: benchmark.acceptance.maximum_relative_error_percent,
    },
  );

  assert.equal(report.passed, true);
  assert.equal(report.checks.length, 12);
  assert.equal(report.checks.filter((check) => check.passed).length, 12);
  assert.ok(report.maximumAbsoluteErrorFt < 1e-6);
  assert.ok(fit.rmsResidualFt < 1e-6);
});
