import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdfPageGeometry } from '../src/lib/pdfPlanGeometry';
import { buildReadingL21Draft, publishApprovedGradingPackage, READING_PLAN_SHA256 } from '../src/lib/gradingPipeline';
import { buildReadingSanitaryDraft, publishApprovedSanitaryPackage } from '../src/lib/sanitaryPipeline';
import { buildReadingStormDraft, publishApprovedStormPackage } from '../src/lib/stormPipeline';
import { buildReadingWaterDraft, publishApprovedWaterPackage, type WaterReviewDecision } from '../src/lib/waterPipeline';

const fixture = 'fixtures/plan-sets/reading-public-library/25020-RPL_Bid_Drawings_2025_07_11.pdf';

test('publishes only two survey-supported water gates and withholds all water-main claims', async () => {
  const document = await getDocument({ data: new Uint8Array(fs.readFileSync(fixture)), disableWorker: true }).promise;
  try {
    const page2 = await extractPdfPageGeometry(document, await document.getPage(2));
    const draft = buildReadingWaterDraft(page2, READING_PLAN_SHA256);
    assert.equal(draft.sheet, 'Topographic Survey');
    assert.equal(draft.candidates.length, 2);
    assert.ok(draft.candidates.every((candidate) => candidate.kind === 'water_gate' && candidate.confidence === 'medium'));
    assert.ok(draft.candidates.every((candidate) => candidate.provenance.extraction === 'manual_vector_review'));
    assert.ok(draft.candidates.every((candidate) => candidate.values.mainGeometry === undefined && candidate.values.connections === undefined));
    assert.equal(draft.excludedEvidence.length, 3);
    assert.ok(draft.limitations.some((value) => value.includes('Water main geometry is unavailable')));

    const page6 = await extractPdfPageGeometry(document, await document.getPage(6));
    const gradingDraft = buildReadingL21Draft(page6, READING_PLAN_SHA256);
    const grading = publishApprovedGradingPackage(gradingDraft, gradingDraft.candidates.map((candidate) => ({ candidateId: candidate.id, decision: candidate.kind === 'grading_note' ? 'rejected' as const : 'approved' as const, reviewer: 'Reviewer' })), '2026-08-21T12:00:00.000Z');
    const sanitaryDraft = buildReadingSanitaryDraft(page2, READING_PLAN_SHA256);
    const sanitary = publishApprovedSanitaryPackage(grading, sanitaryDraft, sanitaryDraft.candidates.map((candidate) => ({ candidateId: candidate.id, decision: 'approved' as const, reviewer: 'Reviewer' })), '2026-08-21T13:00:00.000Z');
    const stormDraft = buildReadingStormDraft(page2, READING_PLAN_SHA256);
    const storm = publishApprovedStormPackage(sanitary, stormDraft, stormDraft.candidates.map((candidate) => ({ candidateId: candidate.id, decision: 'approved' as const, reviewer: 'Reviewer' })), '2026-08-21T14:00:00.000Z');
    const decisions: WaterReviewDecision[] = draft.candidates.map((candidate) => ({ candidateId: candidate.id, decision: 'approved', reviewer: 'Reviewer' }));
    const published = publishApprovedWaterPackage(storm, draft, decisions, '2026-08-21T15:00:00.000Z');

    assert.equal(published.packageVersion, 'reading-public-library-grading-sanitary-storm-water-v4');
    assert.deepEqual(published.layers.map((layer) => layer.name), ['Grading', 'Sanitary', 'Storm', 'Water']);
    assert.equal(published.objects.filter((object) => object.layerId === 'water').length, 2);
    assert.equal(published.utilities.filter((line) => line.layerId === 'water').length, 0);
    assert.deepEqual(published.objects.filter((object) => object.layerId === 'water').map((object) => object.symbol), ['water-gate', 'water-gate']);
    assert.ok(published.objects.filter((object) => object.layerId === 'water').every((object) => object.connections === undefined && object.dimensions === undefined));
    assert.ok(Object.isFrozen(published));
  } finally { await document.destroy(); }
});
