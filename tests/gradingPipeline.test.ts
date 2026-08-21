import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdfPageGeometry } from '../src/lib/pdfPlanGeometry';
import {
  buildReadingL21Draft,
  loadPublishedGradingPackage,
  publishApprovedGradingPackage,
  savePublishedGradingPackage,
  type GradingReviewDecision,
} from '../src/lib/gradingPipeline';

const fixture = 'fixtures/plan-sets/reading-public-library/25020-RPL_Bid_Drawings_2025_07_11.pdf';
const sourceSha256 = '835e28d8d981b4c0a0c5840e006c4cc19f259fc7fcb218ddc744bfec97da97d1';

async function realReadingDraft() {
  const document = await getDocument({
    data: new Uint8Array(fs.readFileSync(fixture)),
    disableWorker: true,
  }).promise;
  try {
    const page = await document.getPage(6);
    return buildReadingL21Draft(await extractPdfPageGeometry(document, page), sourceSha256);
  } finally {
    await document.destroy();
  }
}

test('classifies only source-backed L2.1 grading candidates with provenance', async () => {
  const draft = await realReadingDraft();

  assert.equal(draft.sheet, 'L2.1');
  assert.equal(draft.pdfPage, 6);
  assert.equal(draft.sourceSha256, sourceSha256);
  assert.deepEqual(
    Object.fromEntries(['spot_elevation', 'wall_elevation_pair', 'slope', 'rim_adjustment', 'grading_note'].map(
      (kind) => [kind, draft.candidates.filter((candidate) => candidate.kind === kind).length],
    )),
    { spot_elevation: 10, wall_elevation_pair: 4, slope: 4, rim_adjustment: 2, grading_note: 2 },
  );
  assert.ok(draft.candidates.every((candidate) => candidate.provenance.sheet === 'L2.1'));
  assert.ok(draft.candidates.every((candidate) => candidate.provenance.pdfPage === 6));
  assert.ok(draft.candidates.every((candidate) => candidate.provenance.sourceText.length > 0));
  assert.ok(draft.candidates.every((candidate) => ['high', 'medium'].includes(candidate.confidence)));
  assert.equal(draft.candidates.some((candidate) => candidate.label.includes('162')), false);
});

test('rejects an L2.1 page when the source checksum is not the locked Reading bid set', async () => {
  const document = await getDocument({ data: new Uint8Array(fs.readFileSync(fixture)), disableWorker: true }).promise;
  try {
    const page = await document.getPage(6);
    const geometry = await extractPdfPageGeometry(document, page);
    assert.throws(() => buildReadingL21Draft(geometry, 'wrong-source'), /checksum/i);
  } finally {
    await document.destroy();
  }
});

test('requires an explicit reviewer decision for every candidate before publishing', async () => {
  const draft = await realReadingDraft();
  const incomplete: GradingReviewDecision[] = draft.candidates.slice(1).map((candidate) => ({
    candidateId: candidate.id,
    decision: 'approved',
    reviewer: 'Human reviewer',
  }));

  assert.throws(
    () => publishApprovedGradingPackage(draft, incomplete, '2026-08-21T12:00:00.000Z'),
    /decision for every candidate/i,
  );
});

test('publishes a versioned immutable offline package containing approved grading only', async () => {
  const draft = await realReadingDraft();
  const decisions: GradingReviewDecision[] = draft.candidates.map((candidate) => ({
    candidateId: candidate.id,
    decision: candidate.kind === 'grading_note' ? 'rejected' : 'approved',
    reviewer: 'Human reviewer',
  }));

  const published = publishApprovedGradingPackage(draft, decisions, '2026-08-21T12:00:00.000Z');

  assert.equal(published.packageVersion, 'reading-public-library-l2.1-grading-v1');
  assert.equal(published.immutable, true);
  assert.equal(published.sourceIncluded, false);
  assert.equal(published.layers.length, 1);
  assert.equal(published.layers[0].name, 'Grading');
  assert.equal(published.objects.length, 20);
  assert.ok(published.objects.every((object) => object.layerId === 'grading'));
  assert.ok(published.objects.every((object) => object.workerLabel && object.workerLabel.length <= 24));
  assert.ok(Math.max(...published.objects.map((object) => object.x)) - Math.min(...published.objects.map((object) => object.x)) > 80);
  assert.ok(Math.max(...published.objects.map((object) => object.y)) - Math.min(...published.objects.map((object) => object.y)) > 50);
  assert.ok(published.objects.every((object) => object.provenance?.sourceSha256 === sourceSha256));
  assert.ok(Object.isFrozen(published));
  assert.ok(Object.isFrozen(published.objects));
  assert.match(published.contentHash, /^[a-f0-9]{8}$/);
});

test('stores published versions write-once and rejects corrupted offline data', async () => {
  const draft = await realReadingDraft();
  const decisions: GradingReviewDecision[] = draft.candidates.map((candidate) => ({
    candidateId: candidate.id,
    decision: 'approved',
    reviewer: 'Human reviewer',
  }));
  const published = publishApprovedGradingPackage(draft, decisions, '2026-08-21T12:00:00.000Z');
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };

  savePublishedGradingPackage(storage, published);
  assert.equal(loadPublishedGradingPackage(storage)?.contentHash, published.contentHash);
  const replacement = publishApprovedGradingPackage(draft, decisions, '2026-08-21T12:01:00.000Z');
  assert.throws(() => savePublishedGradingPackage(storage, replacement), /immutable/i);

  const versionKey = `excavation-field-map:semantic-package:${published.packageVersion}`;
  values.set(versionKey, values.get(versionKey)!.replace('Spot elevation 154.19', 'Spot elevation 999.99'));
  assert.throws(() => loadPublishedGradingPackage(storage), /integrity/i);
});
