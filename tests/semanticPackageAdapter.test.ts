import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parseSemanticJobsiteManifest } from '../src/lib/semanticPackageAdapter';

const manifestPath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-sanitary/semantic-manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
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
