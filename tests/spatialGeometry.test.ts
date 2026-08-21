import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceToFeature, pointInPolygon } from '../src/lib/spatialGeometry';
import type { BlueprintObject } from '../src/types/jobsite';

const feature = (geometry: BlueprintObject['geometry']): BlueprintObject => ({
  id: 'feature', type: 'building_pad', layerId: 'site', x: 0, y: 0, label: 'Feature', geometry,
});

test('hit-tests polygons by their actual filled boundary instead of their centroid marker', () => {
  const polygon = feature({ type: 'Polygon', coordinates: [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 40, y: 30 }, { x: 10, y: 30 }, { x: 10, y: 10 }] });
  assert.equal(pointInPolygon({ x: 12, y: 28 }, polygon.geometry!.coordinates), true);
  assert.equal(distanceToFeature({ x: 12, y: 28 }, polygon), 0);
  assert.equal(distanceToFeature({ x: 50, y: 20 }, polygon), 10);
});

test('hit-tests line strings by distance to their segments rather than their midpoint', () => {
  const line = feature({ type: 'LineString', coordinates: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
  assert.equal(distanceToFeature({ x: 3, y: 2 }, line), 2);
  assert.equal(distanceToFeature({ x: 50, y: 9 }, line), 9);
});
