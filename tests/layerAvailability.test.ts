import assert from 'node:assert/strict';
import test from 'node:test';
import { layersAvailableForPhase } from '../src/lib/layerAvailability';
import type { ExcavationLayer } from '../src/types/jobsite';

const layers: ExcavationLayer[] = [
  { id: 'property', name: 'Property', color: '#777', defaultVisible: true },
  { id: 'sanitary', name: 'Sanitary', color: '#707', defaultVisible: true },
  { id: 'site', name: 'Site', color: '#970', defaultVisible: true },
];
const features = [
  { layerId: 'property', phase: 'existing' },
  { layerId: 'sanitary', phase: 'existing' },
  { layerId: 'sanitary', phase: 'proposed' },
  { layerId: 'site', phase: 'proposed' },
];

test('suppresses inert layer controls for a phase and restores them in overview', () => {
  assert.deepEqual(layersAvailableForPhase(layers, features, 'existing').map((layer) => layer.id), ['property', 'sanitary']);
  assert.deepEqual(layersAvailableForPhase(layers, features, 'proposed').map((layer) => layer.id), ['sanitary', 'site']);
  assert.deepEqual(layersAvailableForPhase(layers, features, 'temporary').map((layer) => layer.id), []);
  assert.deepEqual(layersAvailableForPhase(layers, features, '__overview__').map((layer) => layer.id), ['property', 'sanitary', 'site']);
});
