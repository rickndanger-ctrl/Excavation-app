import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parseSemanticJobsiteManifest } from '../src/lib/semanticPackageAdapter';

const manifestPath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-grading-site-prep/semantic-manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;

type Feature = {
  id: string;
  type: string;
  fieldDetail: Record<string, unknown>;
};

function cloneManifest() {
  return structuredClone(manifest) as Record<string, unknown> & {
    linearFeatures: Feature[];
    areas: Feature[];
    surfaces: Feature[];
  };
}

test('imports the verified existing-ground surface and keeps both source and model datum elevations observable', () => {
  const jobsite = parseSemanticJobsiteManifest(manifest);
  const existingGround = jobsite.objects.find((feature) => feature.id === 'surface-existing-grade-reference');
  const contour = jobsite.objects.find((feature) => feature.id === 'existing-contour-14176-1');

  assert.equal(existingGround?.geometry?.type, 'Polygon');
  assert.equal(existingGround?.verticalDatum, 'NAVD88');
  assert.equal(existingGround?.fieldDetail?.source_vertical_datum, 'NGVD29');
  assert.equal(existingGround?.fieldDetail?.model_vertical_datum, 'NAVD88');
  assert.equal(existingGround?.fieldDetail?.vertical_shift_ft, 3.698);
  assert.equal(existingGround?.fieldDetail?.vertical_conversion_uncertainty_ft, 0.165);
  assert.equal(existingGround?.provenance?.status, 'reference-derived');
  assert.deepEqual(existingGround?.provenance?.sourceIds, ['src-eugene-contours-vdatum']);

  assert.equal(contour?.fieldDetail?.source_elevation_ft, 440);
  assert.equal(contour?.fieldDetail?.elevation_ft, 443.698);
  assert.equal(contour?.elevation, '443.698');
  assert.equal(contour?.verticalDatum, 'NAVD88');
});

test('rejects grading terrain when the existing-ground datum conversion provenance is incomplete', () => {
  const missingShift = cloneManifest();
  const surface = missingShift.surfaces.find((feature) => feature.id === 'surface-existing-grade-reference')!;
  delete surface.fieldDetail.vertical_shift_ft;
  assert.throws(() => parseSemanticJobsiteManifest(missingShift), /vertical_shift_ft/i);

  const missingOriginalElevation = cloneManifest();
  const contour = missingOriginalElevation.linearFeatures.find((feature) => feature.id === 'existing-contour-14176-1')!;
  delete contour.fieldDetail.source_elevation_ft;
  assert.throws(() => parseSemanticJobsiteManifest(missingOriginalElevation), /source_elevation_ft/i);
});

test('rejects proposed grading, cut-fill, and surface drainage unless they reference a validated existing-ground basis', () => {
  const noExistingGround = cloneManifest();
  noExistingGround.surfaces = noExistingGround.surfaces.filter((feature) => feature.id !== 'surface-existing-grade-reference');
  assert.throws(() => parseSemanticJobsiteManifest(noExistingGround), /existing-ground datum basis/i);

  const badQuantity = cloneManifest();
  const fill = badQuantity.areas.find((feature) => feature.id === 'earthwork-fill-pad-01')!;
  fill.fieldDetail.volume_cy = 999;
  assert.throws(() => parseSemanticJobsiteManifest(badQuantity), /earthwork-fill-pad-01.*volume/i);

  const unvalidatedFlow = cloneManifest();
  const arrow = unvalidatedFlow.linearFeatures.find((feature) => feature.id === 'drainage-arrow-west-01')!;
  delete arrow.fieldDetail.downhill;
  assert.throws(() => parseSemanticJobsiteManifest(unvalidatedFlow), /drainage-arrow-west-01.*downhill/i);
});
