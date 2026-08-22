import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parseSemanticJobsiteManifest } from '../src/lib/semanticPackageAdapter';

const manifestPath = '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-grading-site-prep/semantic-manifest.json';

test('imports Hilyard site geometry as the finished-job base with preloaded measurement tips', () => {
  const jobsite = parseSemanticJobsiteManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  const finishedLayer = jobsite.layers.find((layer) => layer.id === 'finished-site');
  assert.ok(finishedLayer);
  assert.equal(finishedLayer.name, 'Finished Job Layout');

  const expected = new Set([
    'building-apartment-1',
    'sidewalk-south-entry',
    'sidewalk-north-entry',
    'sidewalk-east-service',
    'sidewalk-arrival-link',
    'paving-arrival-court',
    'landscape-north-court',
  ]);
  const finishedObjects = jobsite.objects.filter((object) => object.layerId === 'finished-site');
  assert.ok([...expected].every((id) => finishedObjects.some((object) => object.id === id)));

  const southWalk = finishedObjects.find((object) => object.id === 'sidewalk-south-entry');
  assert.ok(southWalk);
  const tips = southWalk.fieldDetail?.measurement_tips as Array<Record<string, unknown>>;
  assert.equal(tips.length, 1);
  assert.equal(tips[0].distance_ft, 18.5);
  assert.equal(
    tips[0].label,
    'West edge of south entry walk is 18.5 FT east of the building southwest corner.',
  );
});
