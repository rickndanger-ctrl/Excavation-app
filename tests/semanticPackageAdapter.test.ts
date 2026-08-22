import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parseSemanticJobsiteManifest } from '../src/lib/semanticPackageAdapter';

const manifestPath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-sanitary/semantic-manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
const combinedManifestPath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-water-fire/semantic-manifest.json';
const calibratedManifestPath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-grading-site-prep/semantic-manifest.json';
type Fixture = {
  schema_version: string;
  disclaimer: string;
  objects: Array<{ id: string; provenance: { status: string } }>;
  linearFeatures: Array<{ id: string }>;
  areas: Array<{ coordinates: number[][] }>;
};

test('adapts the current Hilyard producer schema without flattening point, line, or polygon geometry', () => {
  const jobsite = parseSemanticJobsiteManifest(manifest);

  assert.equal(jobsite.id, 'hilyard-apartment-test');
  assert.equal(jobsite.disclaimer, 'FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION');
  assert.equal(jobsite.schemaVersion, 'excavation-field-map.jobsite-package/v0.1.0');
  assert.equal(jobsite.objects.length, 33);
  assert.equal(jobsite.objects.filter((feature) => feature.geometry?.type === 'Point').length, 15);
  assert.equal(jobsite.objects.filter((feature) => feature.geometry?.type === 'LineString').length, 6);
  assert.equal(jobsite.objects.filter((feature) => feature.geometry?.type === 'Polygon').length, 12);

  const parcel = jobsite.objects.find((feature) => feature.id === 'taxlot-10900');
  assert.equal(parcel?.geometry?.type, 'Polygon');
  assert.equal(parcel?.geometry?.coordinates.length, 7);
  assert.equal(parcel?.provenance?.status, 'reference-derived');
  assert.equal(parcel?.fieldDetail?.survey_authority, false);

  const service = jobsite.objects.find((feature) => feature.id === 'sanitary-service-seg-02');
  assert.equal(service?.geometry?.type, 'LineString');
  assert.deepEqual(service?.connections?.downstream, ['sanitary-tie-in-01']);
  assert.equal(service?.dimensions?.pipeSize, '6-in');
  assert.equal(service?.fieldDetail?.hydraulic_status, 'unknown_pending_design_flow');
});

test('rejects unsupported versions, missing disclaimers, duplicate IDs, malformed geometry, and invalid provenance', () => {
  const clone = () => structuredClone(manifest) as Fixture;

  const wrongVersion = clone();
  wrongVersion.schema_version = 'excavation-field-map.jobsite-package/v99';
  assert.throws(() => parseSemanticJobsiteManifest(wrongVersion), /unsupported schema/i);

  const noDisclaimer = clone();
  noDisclaimer.disclaimer = '';
  assert.throws(() => parseSemanticJobsiteManifest(noDisclaimer), /not for construction/i);

  const duplicate = clone();
  duplicate.linearFeatures[0].id = duplicate.objects[0].id;
  assert.throws(() => parseSemanticJobsiteManifest(duplicate), /duplicate feature id/i);

  const malformedPolygon = clone();
  malformedPolygon.areas[0].coordinates = [[0, 0], [1, 1]];
  assert.throws(() => parseSemanticJobsiteManifest(malformedPolygon), /polygon/i);

  const badProvenance = clone();
  badProvenance.objects[0].provenance.status = 'guessed';
  assert.throws(() => parseSemanticJobsiteManifest(badProvenance), /provenance/i);
});

test('splits combined producer water geometry into independent domestic, fire, and source-reference layers', () => {
  const combined = JSON.parse(fs.readFileSync(combinedManifestPath, 'utf8')) as unknown;
  const jobsite = parseSemanticJobsiteManifest(combined);
  const counts = Object.fromEntries(jobsite.layers.map((layer) => [
    layer.id,
    jobsite.objects.filter((feature) => feature.layerId === layer.id).length,
  ]));

  assert.equal(jobsite.objects.length, 71);
  assert.equal(counts.property, 12);
  assert.equal(counts['finished-site'], 5);
  assert.equal(counts.sanitary, 9);
  assert.equal(counts.storm, 18);
  assert.equal(counts.grading, 2);
  assert.equal(counts['domestic-water'], 8);
  assert.equal(counts['fire-water'], 12);
  assert.equal(counts['water-reference'], 1);
  assert.equal(jobsite.layers.some((layer) => layer.id === 'water'), false);

  assert.equal(jobsite.objects.find((feature) => feature.id === 'domestic-water-seg-02')?.layerId, 'domestic-water');
  assert.equal(jobsite.objects.find((feature) => feature.id === 'fire-water-seg-03')?.layerId, 'fire-water');
  assert.equal(jobsite.objects.find((feature) => feature.id === 'water-public-main-34th-reference')?.layerId, 'water-reference');
});

test('imports only the publish-safe plan calibration summary without sealed answers', () => {
  const calibrated = JSON.parse(fs.readFileSync(calibratedManifestPath, 'utf8')) as Record<string, unknown>;
  const jobsite = parseSemanticJobsiteManifest(calibrated);

  assert.deepEqual(jobsite.planCalibration, {
    status: 'passed_product_qa',
    controlCount: 3,
    checkCount: 15,
    passedCheckCount: 15,
    maximumAbsoluteErrorFt: 0.000000499,
    maximumRelativeErrorPercent: 0.000000799,
    controlRmsResidualFt: 0,
    authority: 'Product QA on reference-scale test geometry; not survey or staking control.',
  });
  assert.equal('sealedChecks' in (calibrated.planCalibration as Record<string, unknown>), false);
});
