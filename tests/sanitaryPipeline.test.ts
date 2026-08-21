import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdfPageGeometry } from '../src/lib/pdfPlanGeometry';
import {
  buildReadingSanitaryDraft,
  publishApprovedSanitaryPackage,
  type SanitaryReviewDecision,
} from '../src/lib/sanitaryPipeline';
import { buildReadingL21Draft, publishApprovedGradingPackage, READING_PLAN_SHA256 } from '../src/lib/gradingPipeline';

const fixture = 'fixtures/plan-sets/reading-public-library/25020-RPL_Bid_Drawings_2025_07_11.pdf';

async function openSource() {
  return getDocument({ data: new Uint8Array(fs.readFileSync(fixture)), disableWorker: true }).promise;
}

test('locks sanitary evidence to the Reed Topographic Survey and excludes drainage-only evidence', async () => {
  const document = await openSource();
  try {
    const draft = buildReadingSanitaryDraft(await extractPdfPageGeometry(document, await document.getPage(2)), READING_PLAN_SHA256);
    assert.equal(draft.sheet, 'Topographic Survey');
    assert.equal(draft.pdfPage, 2);
    assert.deepEqual(
      Object.fromEntries(['sewer_manhole', 'cleanout', 'sewer_pipe'].map((kind) => [kind, draft.candidates.filter((candidate) => candidate.kind === kind).length])),
      { sewer_manhole: 2, cleanout: 1, sewer_pipe: 1 },
    );
    assert.equal(draft.excludedEvidence.length, 2);
    assert.ok(draft.excludedEvidence.every((evidence) => evidence.reason.includes('not sanitary')));
    assert.ok(draft.candidates.every((candidate) => candidate.confidence === 'medium'));
    assert.ok(draft.candidates.every((candidate) => candidate.provenance.extraction === 'manual_vector_review'));
    assert.ok(draft.candidates.every((candidate) => candidate.provenance.sheet === 'Topographic Survey'));
    assert.equal(draft.candidates.some((candidate) => 'connections' in candidate.values), false);
    assert.equal(draft.candidates.some((candidate) => 'slopePercent' in candidate.values), false);
  } finally {
    await document.destroy();
  }
});

test('publishes reviewed sanitary features into immutable grading-plus-sanitary v2', async () => {
  const document = await openSource();
  try {
    const gradingDraft = buildReadingL21Draft(await extractPdfPageGeometry(document, await document.getPage(6)), READING_PLAN_SHA256);
    const gradingDecisions = gradingDraft.candidates.map((candidate) => ({ candidateId: candidate.id, decision: candidate.kind === 'grading_note' ? 'rejected' as const : 'approved' as const, reviewer: 'Reviewer' }));
    const grading = publishApprovedGradingPackage(gradingDraft, gradingDecisions, '2026-08-21T12:00:00.000Z');
    const sanitaryDraft = buildReadingSanitaryDraft(await extractPdfPageGeometry(document, await document.getPage(2)), READING_PLAN_SHA256);
    const decisions: SanitaryReviewDecision[] = sanitaryDraft.candidates.map((candidate) => ({ candidateId: candidate.id, decision: 'approved', reviewer: 'Reviewer' }));

    const published = publishApprovedSanitaryPackage(grading, sanitaryDraft, decisions, '2026-08-21T13:00:00.000Z');
    assert.equal(published.packageVersion, 'reading-public-library-grading-sanitary-v2');
    assert.equal(published.immutable, true);
    assert.equal(published.sourceIncluded, false);
    assert.deepEqual(published.layers.map((layer) => layer.name), ['Grading', 'Sanitary']);
    assert.equal(published.objects.filter((object) => object.layerId === 'sanitary').length, 4);
    assert.equal(published.utilities.filter((line) => line.layerId === 'sanitary').length, 1);
    assert.deepEqual(
      published.objects.filter((object) => object.layerId === 'sanitary').map((object) => object.symbol),
      ['sanitary-manhole', 'sanitary-manhole', 'sanitary-cleanout', 'sanitary-pipe'],
    );
    const knownManhole = published.objects.find((object) => object.id === 'survey-smh-west')!;
    assert.equal(knownManhole.rimElevation, '162.54');
    assert.equal(knownManhole.invertIn, '154.49');
    assert.equal(knownManhole.invertOut, '154.44');
    assert.equal(knownManhole.connections, undefined);
    assert.ok(Object.isFrozen(published));
  } finally {
    await document.destroy();
  }
});
