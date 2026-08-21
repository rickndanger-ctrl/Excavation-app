import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdfPageGeometry } from '../src/lib/pdfPlanGeometry';
import { buildReadingL21Draft, publishApprovedGradingPackage, READING_PLAN_SHA256 } from '../src/lib/gradingPipeline';
import { buildReadingSanitaryDraft, publishApprovedSanitaryPackage } from '../src/lib/sanitaryPipeline';
import { buildReadingStormDraft, publishApprovedStormPackage, type StormReviewDecision } from '../src/lib/stormPipeline';

const fixture = 'fixtures/plan-sets/reading-public-library/25020-RPL_Bid_Drawings_2025_07_11.pdf';

async function sourcePage() {
  const document = await getDocument({ data: new Uint8Array(fs.readFileSync(fixture)), disableWorker: true }).promise;
  return { document, page2: await extractPdfPageGeometry(document, await document.getPage(2)), page6: await extractPdfPageGeometry(document, await document.getPage(6)) };
}

test('locks storm structures to the signed survey while withholding unsafe pipe traces', async () => {
  const { document, page2 } = await sourcePage();
  try {
    const draft = buildReadingStormDraft(page2, READING_PLAN_SHA256);
    assert.equal(draft.sheet, 'Topographic Survey');
    assert.equal(draft.pdfPage, 2);
    assert.deepEqual(
      Object.fromEntries(['drainage_manhole', 'catch_basin'].map((kind) => [kind, draft.candidates.filter((candidate) => candidate.kind === kind).length])),
      { drainage_manhole: 7, catch_basin: 2 },
    );
    assert.equal(draft.pendingPipeEvidence.length, 2);
    assert.deepEqual(draft.pendingPipeEvidence.map((item) => item.sourceText), ['12-inch RCP', '30-inch CPP']);
    assert.ok(draft.candidates.every((candidate) => candidate.confidence === 'medium' && candidate.provenance.extraction === 'manual_vector_review'));
    assert.ok(draft.candidates.every((candidate) => candidate.values.connections === undefined));
    assert.ok(draft.limitations.some((value) => value.includes('approximate surface evidence')));
  } finally { await document.destroy(); }
});

test('publishes explicitly reviewed structures as immutable cumulative v3 without invented storm lines', async () => {
  const { document, page2, page6 } = await sourcePage();
  try {
    const gradingDraft = buildReadingL21Draft(page6, READING_PLAN_SHA256);
    const grading = publishApprovedGradingPackage(gradingDraft, gradingDraft.candidates.map((candidate) => ({ candidateId: candidate.id, decision: candidate.kind === 'grading_note' ? 'rejected' as const : 'approved' as const, reviewer: 'Reviewer' })), '2026-08-21T12:00:00.000Z');
    const sanitaryDraft = buildReadingSanitaryDraft(page2, READING_PLAN_SHA256);
    const sanitary = publishApprovedSanitaryPackage(grading, sanitaryDraft, sanitaryDraft.candidates.map((candidate) => ({ candidateId: candidate.id, decision: 'approved' as const, reviewer: 'Reviewer' })), '2026-08-21T13:00:00.000Z');
    const stormDraft = buildReadingStormDraft(page2, READING_PLAN_SHA256);
    const decisions: StormReviewDecision[] = stormDraft.candidates.map((candidate) => ({ candidateId: candidate.id, decision: 'approved', reviewer: 'Reviewer' }));

    const published = publishApprovedStormPackage(sanitary, stormDraft, decisions, '2026-08-21T14:00:00.000Z');
    assert.equal(published.packageVersion, 'reading-public-library-grading-sanitary-storm-v3');
    assert.equal(published.sourceIncluded, false);
    assert.deepEqual(published.layers.map((layer) => layer.name), ['Grading', 'Sanitary', 'Storm']);
    assert.equal(published.objects.filter((object) => object.layerId === 'storm').length, 9);
    assert.equal(published.utilities.filter((line) => line.layerId === 'storm').length, 0);
    assert.deepEqual(published.objects.filter((object) => object.layerId === 'storm').map((object) => object.symbol), [
      'storm-manhole', 'storm-manhole', 'storm-manhole', 'storm-catch-basin', 'storm-catch-basin',
      'storm-manhole', 'storm-manhole', 'storm-manhole', 'storm-manhole',
    ]);
    const first = published.objects.find((object) => object.id === 'survey-dmh-rim-162-55')!;
    assert.equal(first.rimElevation, '162.55');
    assert.equal(first.invertIn, '150.45 / 150.35');
    assert.equal(first.connections, undefined);
    assert.ok(Object.isFrozen(published));
  } finally { await document.destroy(); }
});
