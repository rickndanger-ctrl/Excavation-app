import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  analyzeCompletePlanSet,
  buildStationSlice,
  calibrateProfilePage,
  fitStatePlaneTransform,
  parseSurveyControl,
  type ReviewerControlPoint,
} from '../src/lib/sharedJobModel';

const fixture = '/tmp/codex-odot-complete-job/HAM-114356-PlanSet-AsFiled.pdf';

async function openFixture() {
  return getDocument({ data: new Uint8Array(fs.readFileSync(fixture)), disableWorker: true }).promise;
}

test('catalogs all 57 sheets without claiming raster cross-sections are extracted geometry', async () => {
  const document = await openFixture();
  try {
    const analysis = await analyzeCompletePlanSet(document, 'HAM-114356-PlanSet-AsFiled.pdf');
    assert.equal(analysis.sheetCount, 57);
    assert.equal(analysis.provenance.fileName, 'HAM-114356-PlanSet-AsFiled.pdf');
    assert.deepEqual(analysis.spatialSpine, { controlPage: 4, planPage: 14, roadProfilePage: 15, wallProfilePage: 30 });
    assert.deepEqual(
      analysis.sheets.filter((sheet) => sheet.sourceKind === 'raster-reference').map((sheet) => sheet.pageNumber),
      [16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
    );
    assert.equal(analysis.sheets[13].sourceKind, 'vector-model');
    assert.equal(analysis.sheets[14].sourceKind, 'vector-model');
    assert.equal(analysis.sheets[29].sourceKind, 'vector-model');
    assert.equal(analysis.sheets[40].sourceKind, 'mixed-reference');
  } finally {
    await document.destroy();
  }
});

test('parses the authoritative CRS and all four survey-control rows from page 4', async () => {
  const document = await openFixture();
  try {
    const control = await parseSurveyControl(await document.getPage(4));
    assert.deepEqual(control.crs, {
      horizontalReferenceFrame: 'NAD 83 (2011) (EPOCH 2010.0)',
      coordinateSystem: 'SPC (3402 OH SOUTH)',
      verticalDatum: 'NAVD 88',
      geoid: '18',
      units: 'U.S. survey feet',
      projectAdjustmentFactor: 1,
    });
    assert.deepEqual(control.monuments, [
      { id: '100', northing: 390693.697, easting: 1433935.967, elevation: 585.884, stationFt: 199407.49, offsetFt: -81.23 },
      { id: '101', northing: 390525.084, easting: 1434331.841, elevation: 599.014, stationFt: 198967.05, offsetFt: -87.71 },
      { id: '102', northing: 390474.305, easting: 1434045.689, elevation: 526.572, stationFt: 199216.66, offsetFt: -249.38 },
      { id: '103', northing: 390303.759, easting: 1434257.215, elevation: 552.546, stationFt: 198942.47, offsetFt: -320 },
    ]);
  } finally {
    await document.destroy();
  }
});

test('fits reviewed plan points to State Plane and rejects degenerate or inaccurate control', () => {
  const controls: ReviewerControlPoint[] = [
    { id: '100', page: { x: 0, y: 0 }, world: { easting: 1000, northing: 2000 } },
    { id: '101', page: { x: 10, y: 0 }, world: { easting: 1020, northing: 2000 } },
    { id: '102', page: { x: 0, y: 10 }, world: { easting: 1000, northing: 2020 } },
  ];
  const fit = fitStatePlaneTransform(controls, 0.25);
  const transformed = fit.toWorld({ x: 4, y: 3 });
  assert.ok(Math.abs(transformed.easting - 1008) < 1e-9);
  assert.ok(Math.abs(transformed.northing - 2006) < 1e-9);
  assert.ok(fit.rmsResidualFt < 1e-9);
  assert.throws(
    () => fitStatePlaneTransform([
      controls[0],
      { ...controls[1], page: { x: 1, y: 1 } },
      { ...controls[2], page: { x: 2, y: 2 } },
    ], 0.25),
    /degenerate/i,
  );
  assert.throws(
    () => fitStatePlaneTransform([
      controls[0],
      controls[1],
      { ...controls[2], world: { easting: 1040, northing: 2050 } },
    ], 0.25),
    /residual/i,
  );
});

test('maps station 1991+00 to the same slice in plan, roadway profile, and wall profile', async () => {
  const document = await openFixture();
  try {
    const road = await calibrateProfilePage(await document.getPage(15), 'roadway');
    const wall = await calibrateProfilePage(await document.getPage(30), 'wall');
    assert.ok(Math.abs(road.pointsPerStationFoot - 3.6) < 0.001);
    assert.ok(Math.abs(wall.pointsPerStationFoot - 3.6) < 0.001);
    assert.deepEqual(road.grade, {
      begin: { stationFt: 198978.55, elevationFt: 600.04 },
      end: { stationFt: 199264.8, elevationFt: 592.25 },
    });

    const slice = buildStationSlice({
      stationFt: 199100,
      alignment: [
        { stationFt: 198900, page: { x: 320, y: 1000 } },
        { stationFt: 199100, page: { x: 1040, y: 1010 } },
        { stationFt: 199400, page: { x: 2120, y: 1030 } },
      ],
      road,
      wall,
    });
    assert.equal(slice.coordinate.stationFt, 199100);
    assert.equal(slice.coordinate.offsetFt, 0);
    assert.ok(Math.abs((slice.coordinate.elevationFt ?? 0) - 596.734) < 0.01);
    assert.deepEqual(slice.planPagePoint, { x: 1040, y: 1010 });
    assert.ok(Math.abs(slice.roadProfileX - 1034.34) < 0.1);
    assert.ok(Math.abs(slice.wallProfileX - 1046.88) < 0.2);
    assert.equal(slice.units.station, 'U.S. survey feet');
    assert.equal(slice.units.elevationDatum, 'NAVD 88');
  } finally {
    await document.destroy();
  }
});
