import type { BlueprintObject } from '../types/jobsite';
import { READING_PLAN_SHA256 } from './gradingPipeline';
import type { PdfPageGeometry } from './pdfPlanGeometry';
import type { PublishedStormPackage } from './stormPipeline';

export type WaterCandidate = {
  id: string; kind: 'water_gate'; label: string; confidence: 'medium'; labelPriority: number;
  planPoint: { x: number; y: number };
  values: { mainGeometry?: never; connections?: never };
  provenance: { sourceSha256: string; sheet: 'Topographic Survey'; pdfPage: 2; sourceText: string[]; sourceItemIndexes: number[]; extraction: 'manual_vector_review'; status: 'reference-derived' };
};
export type WaterDraft = {
  projectId: 'reading-public-library'; sheet: 'Topographic Survey'; pdfPage: 2; sourceSha256: string;
  candidates: WaterCandidate[];
  excludedEvidence: Array<{ source: string; reason: string }>;
  limitations: string[];
};
export type WaterReviewDecision = { candidateId: string; decision: 'approved' | 'rejected'; reviewer: string };
export type PublishedWaterPackage = Omit<PublishedStormPackage, 'packageVersion' | 'contentHash' | 'reviews' | 'sourceLedger'> & {
  packageVersion: 'reading-public-library-grading-sanitary-storm-water-v4'; contentHash: string;
  reviews: PublishedStormPackage['reviews'] & { water: { reviewer: string; approvedCandidateIds: string[]; rejectedCandidateIds: string[] } };
  sourceLedger: Array<unknown>;
};

export function buildReadingWaterDraft(geometry: PdfPageGeometry, sourceSha256: string): WaterDraft {
  if (sourceSha256 !== READING_PLAN_SHA256) throw new Error('The source checksum does not match the locked Reading bid set.');
  if (geometry.pageNumber !== 2) throw new Error('Water evidence is locked to PDF page 2, the Topographic Survey.');
  const make = (id: string, label: string, x: number, y: number, labelPriority: number): WaterCandidate => ({
    id, kind: 'water_gate', label, confidence: 'medium', labelPriority, planPoint: { x, y }, values: {},
    provenance: { sourceSha256, sheet: 'Topographic Survey', pdfPage: 2, sourceText: ['WG'], sourceItemIndexes: [], extraction: 'manual_vector_review', status: 'reference-derived' },
  });
  return {
    projectId: 'reading-public-library', sheet: 'Topographic Survey', pdfPage: 2, sourceSha256,
    candidates: [make('survey-wg-southeast-west', 'Existing water gate · southeast Middlesex Avenue frontage', 86, 68, 310), make('survey-wg-southeast-east', 'Existing water gate · southeast Middlesex Avenue frontage', 93, 72, 300)],
    excludedEvidence: [
      { source: 'Survey legend water and fire-hydrant symbols', reason: 'Legend-only symbols are not mapped assets.' },
      { source: 'Storm and sanitary assets', reason: 'They are outside the water layer.' },
      { source: 'Generic utility notes', reason: 'They do not establish a mapped water asset.' },
    ],
    limitations: [
      'Water main geometry is unavailable; no line, size, depth, hydrant, or connectivity is published.',
      'Survey utility locations are approximate surface evidence from manual vector review.',
      'Not for construction staking; verify utility records, field locates, and survey control.',
    ],
  };
}

function toObject(candidate: WaterCandidate): BlueprintObject {
  return {
    id: candidate.id, type: 'gate_valve', layerId: 'water', x: candidate.planPoint.x, y: candidate.planPoint.y,
    label: candidate.label, workerLabel: 'WG · EXISTING', symbol: 'water-gate', labelPriority: candidate.labelPriority,
    system: 'water', blueprintSheet: 'Topographic Survey', confidence: candidate.confidence, provenance: candidate.provenance,
    notes: 'Water main geometry is unavailable. Survey utility location is approximate surface evidence. Not for construction staking.',
  };
}
function hashText(value: string): string { let hash = 0x811c9dc5; for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 0x01000193); } return (hash >>> 0).toString(16).padStart(8, '0'); }
function deepFreeze<T>(value: T): T { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }

export function publishApprovedWaterPackage(base: PublishedStormPackage, draft: WaterDraft, decisions: WaterReviewDecision[], publishedAt: string): PublishedWaterPackage {
  const byId = new Map(decisions.map((decision) => [decision.candidateId, decision]));
  if (byId.size !== draft.candidates.length || draft.candidates.some((candidate) => !byId.has(candidate.id))) throw new Error('Publishing requires an explicit review decision for every water candidate.');
  if (decisions.some((decision) => !decision.reviewer.trim())) throw new Error('Every water decision must identify the reviewer.');
  const approved = draft.candidates.filter((candidate) => byId.get(candidate.id)?.decision === 'approved');
  const rejected = draft.candidates.filter((candidate) => byId.get(candidate.id)?.decision === 'rejected');
  const { packageVersion: _version, contentHash: _hash, reviews, ...baseCore } = base;
  void _version; void _hash;
  const core = {
    ...baseCore, publishedAt, packageVersion: 'reading-public-library-grading-sanitary-storm-water-v4' as const,
    layers: [...base.layers, { id: 'water', name: 'Water', color: '#2563eb', defaultVisible: true }],
    objects: [...base.objects, ...approved.map(toObject)], utilities: [...base.utilities],
    reviews: { ...reviews, water: { reviewer: decisions[0]?.reviewer ?? 'Unknown reviewer', approvedCandidateIds: approved.map((candidate) => candidate.id), rejectedCandidateIds: rejected.map((candidate) => candidate.id) } },
    sourceLedger: [...base.sourceLedger, { fileName: '25020-RPL_Bid_Drawings_2025_07_11.pdf', sha256: draft.sourceSha256, sheet: 'Topographic Survey', pdfPage: 2, authority: 'survey', status: 'reference-derived' }],
    limitations: [...base.limitations, ...draft.limitations],
  };
  return deepFreeze({ ...core, contentHash: hashText(JSON.stringify(core)) }) as PublishedWaterPackage;
}
