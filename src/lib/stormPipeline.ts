import type { BlueprintObject } from '../types/jobsite';
import { READING_PLAN_SHA256 } from './gradingPipeline';
import type { PdfPageGeometry } from './pdfPlanGeometry';
import type { PublishedCombinedPackage } from './sanitaryPipeline';

export type StormCandidateKind = 'drainage_manhole' | 'catch_basin';
export type StormCandidate = {
  id: string;
  kind: StormCandidateKind;
  label: string;
  confidence: 'medium';
  labelPriority: number;
  planPoint: { x: number; y: number };
  values: { rimElevationFt: number; invertInFt?: number[]; invertOutFt?: number; note?: string; connections?: never };
  provenance: {
    sourceSha256: string; sheet: 'Topographic Survey'; pdfPage: 2; sourceText: string[];
    sourceItemIndexes: number[]; extraction: 'manual_vector_review'; status: 'reference-derived';
  };
};

export type StormDraft = {
  projectId: 'reading-public-library'; sheet: 'Topographic Survey'; pdfPage: 2; sourceSha256: string;
  candidates: StormCandidate[];
  pendingPipeEvidence: Array<{ sourceText: '12-inch RCP' | '30-inch CPP'; reason: string }>;
  excludedEvidence: Array<{ source: string; reason: string }>;
  limitations: string[];
};

export type StormReviewDecision = { candidateId: string; decision: 'approved' | 'rejected'; reviewer: string };

export type PublishedStormPackage = Omit<PublishedCombinedPackage, 'packageVersion' | 'contentHash' | 'reviews' | 'sourceLedger'> & {
  packageVersion: 'reading-public-library-grading-sanitary-storm-v3';
  contentHash: string;
  reviews: PublishedCombinedPackage['reviews'] & { storm: { reviewer: string; approvedCandidateIds: string[]; rejectedCandidateIds: string[] } };
  sourceLedger: Array<unknown>;
};

function provenance(sourceSha256: string, sourceText: string[]): StormCandidate['provenance'] {
  return { sourceSha256, sheet: 'Topographic Survey', pdfPage: 2, sourceText, sourceItemIndexes: [], extraction: 'manual_vector_review', status: 'reference-derived' };
}

export function buildReadingStormDraft(geometry: PdfPageGeometry, sourceSha256: string): StormDraft {
  if (sourceSha256 !== READING_PLAN_SHA256) throw new Error('The source checksum does not match the locked Reading bid set.');
  if (geometry.pageNumber !== 2) throw new Error('Storm evidence is locked to PDF page 2, the Topographic Survey.');
  const raw: Array<Omit<StormCandidate, 'confidence' | 'provenance'>> = [
    { id: 'survey-dmh-rim-162-55', kind: 'drainage_manhole', label: 'DMH · RIM 162.55 · A 150.45 · B 150.35', labelPriority: 390, planPoint: { x: 25, y: 18 }, values: { rimElevationFt: 162.55, invertInFt: [150.45, 150.35], note: 'Adjacent 30-inch CPP evidence; connectivity withheld.' } },
    { id: 'survey-dmh-rim-162-64', kind: 'drainage_manhole', label: 'DMH · RIM 162.64 · A 157.19 · B 146.94 · OUT 146.69', labelPriority: 380, planPoint: { x: 45, y: 22 }, values: { rimElevationFt: 162.64, invertInFt: [157.19, 146.94], invertOutFt: 146.69 } },
    { id: 'survey-dmh-rim-153-73', kind: 'drainage_manhole', label: 'DMH · RIM 153.73 · A 143.68 · B 143.28 · OUT 143.25', labelPriority: 370, planPoint: { x: 66, y: 25 }, values: { rimElevationFt: 153.73, invertInFt: [143.68, 143.28], invertOutFt: 143.25 } },
    { id: 'survey-cb-rim-152-93', kind: 'catch_basin', label: 'CB · RIM 152.93 · OUT 149.38', labelPriority: 290, planPoint: { x: 82, y: 34 }, values: { rimElevationFt: 152.93, invertOutFt: 149.38 } },
    { id: 'survey-cb-rim-151-65', kind: 'catch_basin', label: 'CB · RIM 151.65 · OUT 148.70', labelPriority: 280, planPoint: { x: 73, y: 48 }, values: { rimElevationFt: 151.65, invertOutFt: 148.70 } },
    { id: 'survey-dmh-rim-151-91', kind: 'drainage_manhole', label: 'DMH · RIM 151.91 · A 147.81 · B 147.91 · OUT 147.66', labelPriority: 360, planPoint: { x: 58, y: 55 }, values: { rimElevationFt: 151.91, invertInFt: [147.81, 147.91], invertOutFt: 147.66 } },
    { id: 'survey-dmh-rim-151-72', kind: 'drainage_manhole', label: 'DMH · RIM 151.72 · A 140.87 · B 140.87 · OUT 140.84', labelPriority: 350, planPoint: { x: 40, y: 60 }, values: { rimElevationFt: 151.72, invertInFt: [140.87, 140.87], invertOutFt: 140.84 } },
    { id: 'survey-storm-ceptor', kind: 'drainage_manhole', label: 'STORM CEPTOR · RIM 149.18 · IN 140.80 · OUT 140.88', labelPriority: 400, planPoint: { x: 26, y: 67 }, values: { rimElevationFt: 149.18, invertInFt: [140.80], invertOutFt: 140.88, note: 'Source label reads STORM CEPTOR.' } },
    { id: 'survey-street-dmh', kind: 'drainage_manhole', label: 'Street DMH · RIM 146.04 · IN 139.94 · OUT 139.74', labelPriority: 340, planPoint: { x: 14, y: 74 }, values: { rimElevationFt: 146.04, invertInFt: [139.94], invertOutFt: 139.74 } },
  ];
  return {
    projectId: 'reading-public-library', sheet: 'Topographic Survey', pdfPage: 2, sourceSha256,
    candidates: raw.map((candidate) => ({ ...candidate, confidence: 'medium', provenance: provenance(sourceSha256, [candidate.label]) })),
    pendingPipeEvidence: [
      { sourceText: '12-inch RCP', reason: 'Visible size and material are retained, but exact trace and connectivity are unsafe to claim.' },
      { sourceText: '30-inch CPP', reason: 'Visible beside a DMH, but exact trace and connectivity are unsafe to claim.' },
    ],
    excludedEvidence: [
      { source: 'L2.1 page 6', reason: 'Corroboration only; it does not replace the signed survey source.' },
      { source: 'Sanitary and generic utility evidence', reason: 'Not classified as storm.' },
      { source: 'Survey legend-only symbols', reason: 'A legend entry is not a mapped asset.' },
    ],
    limitations: [
      'Manual vector review of the signed Reed Land Surveying Topographic Survey dated April 21, 2025.',
      'Survey positions used in this field model are approximate surface evidence and are not calibrated field control.',
      'Pipe geometry, connectivity, length, slope, and flow direction remain pending trace and are not published.',
      'Not for construction; verify utility records, field locates, and survey control.',
    ],
  };
}

function toObject(candidate: StormCandidate): BlueprintObject {
  const isDmh = candidate.kind === 'drainage_manhole';
  const incoming = candidate.values.invertInFt?.map((value) => value.toFixed(2)).join(' / ');
  return {
    id: candidate.id, type: isDmh ? 'manhole' : 'catch_basin', layerId: 'storm', x: candidate.planPoint.x, y: candidate.planPoint.y,
    label: candidate.label, workerLabel: isDmh ? `DMH RIM ${candidate.values.rimElevationFt.toFixed(2)}` : `CB RIM ${candidate.values.rimElevationFt.toFixed(2)}`,
    symbol: isDmh ? 'storm-manhole' : 'storm-catch-basin', labelPriority: candidate.labelPriority, system: 'storm',
    rimElevation: candidate.values.rimElevationFt.toFixed(2), invertIn: incoming, invertOut: candidate.values.invertOutFt?.toFixed(2),
    notes: `${candidate.values.note ? `${candidate.values.note} ` : ''}Approximate survey surface evidence from the signed Reed Topographic Survey. Not for construction.`,
    blueprintSheet: 'Topographic Survey', confidence: candidate.confidence, provenance: candidate.provenance,
  };
}

function hashText(value: string): string { let hash = 0x811c9dc5; for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 0x01000193); } return (hash >>> 0).toString(16).padStart(8, '0'); }
function deepFreeze<T>(value: T): T { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }

export function publishApprovedStormPackage(base: PublishedCombinedPackage, draft: StormDraft, decisions: StormReviewDecision[], publishedAt: string): PublishedStormPackage {
  const byId = new Map(decisions.map((decision) => [decision.candidateId, decision]));
  if (byId.size !== draft.candidates.length || draft.candidates.some((candidate) => !byId.has(candidate.id))) throw new Error('Publishing requires an explicit review decision for every storm candidate.');
  if (decisions.some((decision) => !decision.reviewer.trim())) throw new Error('Every storm decision must identify the reviewer.');
  const approved = draft.candidates.filter((candidate) => byId.get(candidate.id)?.decision === 'approved');
  const rejected = draft.candidates.filter((candidate) => byId.get(candidate.id)?.decision === 'rejected');
  const { packageVersion: _version, contentHash: _hash, reviews, sourceLedger, ...baseCore } = base;
  void _version; void _hash;
  const core = {
    ...baseCore, publishedAt, packageVersion: 'reading-public-library-grading-sanitary-storm-v3' as const,
    layers: [...base.layers, { id: 'storm', name: 'Storm', color: '#0369a1', defaultVisible: true }],
    objects: [...base.objects, ...approved.map(toObject)], utilities: [...base.utilities],
    reviews: { ...reviews, storm: { reviewer: decisions[0]?.reviewer ?? 'Unknown reviewer', approvedCandidateIds: approved.map((candidate) => candidate.id), rejectedCandidateIds: rejected.map((candidate) => candidate.id) } },
    sourceLedger: [...sourceLedger, { fileName: '25020-RPL_Bid_Drawings_2025_07_11.pdf', sha256: draft.sourceSha256, sheet: 'Topographic Survey', pdfPage: 2, authority: 'survey', status: 'reference-derived' }],
    limitations: [...base.limitations, ...draft.limitations, ...draft.pendingPipeEvidence.map((item) => `${item.sourceText}: ${item.reason}`)],
  };
  return deepFreeze({ ...core, contentHash: hashText(JSON.stringify(core)) }) as PublishedStormPackage;
}
