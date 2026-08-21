import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GRADING_HIT_RADIUS,
  layoutGradingLabels,
  type GradingLabelInput,
} from '../src/lib/gradingLayout';

const crowded: GradingLabelInput[] = [
  { id: 'left', x: 9, y: 20, text: 'BW 155.27 / TW 156.77' },
  { id: 'center-a', x: 58, y: 39, text: '155.21' },
  { id: 'center-b', x: 60, y: 40, text: '155.27' },
  { id: 'center-c', x: 62, y: 41, text: 'Slope 1.5%' },
  { id: 'center-d', x: 60, y: 40, text: '155.03' },
  { id: 'center-e', x: 60, y: 40, text: '155.21' },
  { id: 'center-f', x: 60, y: 40, text: '155.33' },
  { id: 'center-g', x: 60, y: 40, text: 'Slope 4.9%' },
  { id: 'center-h', x: 60, y: 40, text: 'DMH rim 155.00' },
  { id: 'center-i', x: 60, y: 40, text: 'CO rim 155.29' },
  { id: 'center-j', x: 60, y: 40, text: 'BW 158.39 / TW 159.89' },
  { id: 'right', x: 111, y: 44, text: 'CO rim 155.29' },
];

function overlaps(a: { left: number; right: number; top: number; bottom: number }, b: typeof a) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

test('lays out grading labels deterministically inside padded plan bounds without collisions', () => {
  const first = layoutGradingLabels(crowded, { width: 120, height: 80 });
  const second = layoutGradingLabels(crowded, { width: 120, height: 80 });
  assert.deepEqual(second, first);

  const visible = first.filter((label) => !label.suppressed);
  assert.ok(visible.length >= 3);
  assert.ok(visible.length < crowded.length);
  for (const label of visible) {
    assert.ok(label.bounds.left >= 2);
    assert.ok(label.bounds.right <= 118);
    assert.ok(label.bounds.top >= 2);
    assert.ok(label.bounds.bottom <= 78);
  }
  for (let left = 0; left < visible.length; left += 1) {
    for (let right = left + 1; right < visible.length; right += 1) {
      assert.equal(overlaps(visible[left].bounds, visible[right].bounds), false);
    }
  }
});

test('keeps glove-sized grading hit geometry inside the normalized review extent', () => {
  assert.equal(GRADING_HIT_RADIUS, 7.5);
  assert.ok(crowded.every((feature) => feature.x - GRADING_HIT_RADIUS >= 1.5));
  assert.ok(crowded.every((feature) => feature.x + GRADING_HIT_RADIUS <= 118.5));
});

test('places higher-priority sanitary structure and invert labels before pipe attributes', () => {
  const laidOut = layoutGradingLabels([
    { id: 'pipe', x: 60, y: 40, text: '8-in PVC', priority: 100 },
    { id: 'structure', x: 60, y: 40, text: 'SMH IN 154.49 / OUT 154.44', priority: 300 },
  ], { width: 120, height: 80 });
  const structure = laidOut.find((label) => label.id === 'structure')!;
  const pipe = laidOut.find((label) => label.id === 'pipe')!;
  assert.equal(structure.labelY, 33);
  assert.notEqual(pipe.labelY, 33);
});
