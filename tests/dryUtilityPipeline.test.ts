import assert from 'node:assert/strict'; import fs from 'node:fs'; import test from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'; import { extractPdfPageGeometry } from '../src/lib/pdfPlanGeometry';
import { READING_PLAN_SHA256 } from '../src/lib/gradingPipeline'; import { buildReadingDryUtilityDraft } from '../src/lib/dryUtilityPipeline';

const fixture = 'fixtures/plan-sets/reading-public-library/25020-RPL_Bid_Drawings_2025_07_11.pdf';
test('keeps OHW pending and publishes only two surveyed light-bollard candidates', async () => {
  const document = await getDocument({ data: new Uint8Array(fs.readFileSync(fixture)), disableWorker: true }).promise;
  try {
    const draft = buildReadingDryUtilityDraft(await extractPdfPageGeometry(document, await document.getPage(2)), READING_PLAN_SHA256);
    assert.equal(draft.candidates.length, 2); assert.ok(draft.candidates.every((candidate) => candidate.kind === 'light_bollard'));
    assert.equal(draft.pendingEvidence.length, 2); assert.equal(draft.pendingEvidence[0].source, 'OHW overhead-wire corridor'); assert.equal(draft.pendingEvidence[1].source, 'Utility pole symbols');
    assert.equal(draft.excludedEvidence.length, 4); assert.ok(draft.candidates.every((candidate) => candidate.confidence === 'medium' && candidate.provenance.extraction === 'manual_vector_review'));
    assert.ok(draft.limitations.some((value) => value.includes('not for construction staking')));
  } finally { await document.destroy(); }
});
