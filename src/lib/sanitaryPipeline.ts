import type { BlueprintObject, UtilityLine } from '../types/jobsite';
import { READING_PLAN_SHA256, type PublishedGradingPackage } from './gradingPipeline';
import type { PdfPageGeometry } from './pdfPlanGeometry';

export type SanitaryCandidateKind = 'sewer_manhole' | 'cleanout' | 'sewer_pipe';
export type SanitaryCandidate = {
  id: string;
  kind: SanitaryCandidateKind;
  label: string;
  confidence: 'medium';
  labelPriority: number;
  planPoint: { x: number; y: number };
  linePoints?: Array<{ x: number; y: number }>;
  values: { rimElevationFt?: number; invertInFt?: number; invertOutFt?: number; pipeSize?: string; material?: string; note?: string };
  provenance: {
    sourceSha256: string;
    sheet: 'Topographic Survey';
    pdfPage: 2;
    sourceText: string[];
    sourceItemIndexes: number[];
    extraction: 'manual_vector_review';
    status: 'reference-derived';
  };
};

export type SanitaryDraft = {
  projectId: 'reading-public-library';
  sheet: 'Topographic Survey';
  pdfPage: 2;
  sourceSha256: string;
  candidates: SanitaryCandidate[];
  excludedEvidence: Array<{ sheet: string; pdfPage: number; sourceText: string; reason: string }>;
  limitations: string[];
};

export type SanitaryReviewDecision = { candidateId: string; decision: 'approved' | 'rejected'; reviewer: string };

export type PublishedCombinedPackage = Omit<PublishedGradingPackage, 'packageVersion' | 'contentHash' | 'review' | 'sourceLedger'> & {
  packageVersion: 'reading-public-library-grading-sanitary-v2';
  contentHash: string;
  reviews: { grading: PublishedGradingPackage['review']; sanitary: { reviewer: string; approvedCandidateIds: string[]; rejectedCandidateIds: string[] } };
  sourceLedger: Array<PublishedGradingPackage['sourceLedger'] | {
    fileName: '25020-RPL_Bid_Drawings_2025_07_11.pdf'; sha256: string; sheet: 'Topographic Survey'; pdfPage: 2;
    authority: 'survey'; status: 'reference-derived';
  }>;
};

function source(sourceSha256: string, sourceText: string[]): SanitaryCandidate['provenance'] {
  return { sourceSha256, sheet: 'Topographic Survey', pdfPage: 2, sourceText, sourceItemIndexes: [], extraction: 'manual_vector_review', status: 'reference-derived' };
}

export function buildReadingSanitaryDraft(geometry: PdfPageGeometry, sourceSha256: string): SanitaryDraft {
  if (sourceSha256 !== READING_PLAN_SHA256) throw new Error('The source checksum does not match the locked Reading bid set.');
  if (geometry.pageNumber !== 2) throw new Error('Sanitary evidence is locked to PDF page 2, the Topographic Survey.');
  const candidates: SanitaryCandidate[] = [
    {
      id: 'survey-smh-west', kind: 'sewer_manhole', label: 'Existing sewer manhole · RIM 162.54 · IN 154.49 · OUT 154.44',
      confidence: 'medium', labelPriority: 300, planPoint: { x: 34, y: 28 },
      values: { rimElevationFt: 162.54, invertInFt: 154.49, invertOutFt: 154.44 },
      provenance: source(sourceSha256, ['SMH', 'RIM=162.54', 'IN=154.49', 'OUT=154.44']),
    },
    {
      id: 'survey-smh-east', kind: 'sewer_manhole', label: 'Existing sewer manhole · attributes not shown',
      confidence: 'medium', labelPriority: 250, planPoint: { x: 76, y: 35 }, values: {},
      provenance: source(sourceSha256, ['S sewer-manhole symbol']),
    },
    {
      id: 'survey-cleanout', kind: 'cleanout', label: 'Existing cleanout · RIM 156.85 · 6-inch PVC · could not open',
      confidence: 'medium', labelPriority: 200, planPoint: { x: 52, y: 66 },
      values: { rimElevationFt: 156.85, pipeSize: '6-in', material: 'PVC', note: 'Could not open' },
      provenance: source(sourceSha256, ['CLEAN OUT', 'RIM=156.85', '6” PVC', 'COULD NOT OPEN']),
    },
    {
      id: 'survey-sewer-run', kind: 'sewer_pipe', label: 'Existing sewer · 8-inch PVC',
      confidence: 'medium', labelPriority: 100, planPoint: { x: 55, y: 32 },
      linePoints: [{ x: 34, y: 28 }, { x: 76, y: 35 }], values: { pipeSize: '8-in', material: 'PVC' },
      provenance: source(sourceSha256, ['S', '8” PVC', 'S']),
    },
  ];
  return {
    projectId: 'reading-public-library', sheet: 'Topographic Survey', pdfPage: 2, sourceSha256, candidates,
    excludedEvidence: [
      { sheet: 'L2.1', pdfPage: 6, sourceText: 'RAISE EXISTING DMH RIM TO ELEVATION 155.00', reason: 'DMH is identified as drainage, not sanitary.' },
      { sheet: 'SP1.1', pdfPage: 3, sourceText: 'PROTECT EXISTING CLEANOUT AND ASSOCIATED DRAIN LINE TO REMAIN', reason: 'The associated line is called drain, not sanitary.' },
    ],
    limitations: [
      'Manual vector review of the signed survey because drawing annotations are not exposed as native PDF text.',
      'Sheet-space review geometry is not calibrated field control.',
      'No source structure IDs, pipe slope, or explicit network connectivity are claimed.',
      'Not for construction; verify against survey control, utility records, and field locates.',
    ],
  };
}

function candidateToObject(candidate: SanitaryCandidate): BlueprintObject {
  const symbol = candidate.kind === 'sewer_manhole' ? 'sanitary-manhole' : candidate.kind === 'cleanout' ? 'sanitary-cleanout' : 'sanitary-pipe';
  const workerLabel = candidate.kind === 'sewer_manhole'
    ? candidate.values.invertInFt === undefined ? 'SMH' : `SMH IN ${candidate.values.invertInFt.toFixed(2)} / OUT ${candidate.values.invertOutFt!.toFixed(2)}`
    : candidate.kind === 'cleanout' ? `CO RIM ${candidate.values.rimElevationFt!.toFixed(2)}` : `${candidate.values.pipeSize} ${candidate.values.material}`;
  return {
    id: candidate.id, type: candidate.kind === 'sewer_manhole' ? 'manhole' : candidate.kind === 'cleanout' ? 'cleanout' : 'sanitary_pipe',
    layerId: 'sanitary', x: candidate.planPoint.x, y: candidate.planPoint.y, label: candidate.label, workerLabel, symbol,
    labelPriority: candidate.labelPriority, rimElevation: candidate.values.rimElevationFt?.toFixed(2),
    invertIn: candidate.values.invertInFt?.toFixed(2), invertOut: candidate.values.invertOutFt?.toFixed(2),
    dimensions: candidate.values.pipeSize ? { pipeSize: candidate.values.pipeSize } : undefined,
    materials: candidate.values.material ? { pipe: candidate.values.material } : undefined,
    notes: candidate.values.note ?? 'Reference-derived from the Reed Topographic Survey. Not for construction.',
    blueprintSheet: 'Topographic Survey', confidence: candidate.confidence, provenance: candidate.provenance,
  };
}

function hashText(value: string): string { let hash = 0x811c9dc5; for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 0x01000193); } return (hash >>> 0).toString(16).padStart(8, '0'); }
function deepFreeze<T>(value: T): T { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }

export function publishApprovedSanitaryPackage(base: PublishedGradingPackage, draft: SanitaryDraft, decisions: SanitaryReviewDecision[], publishedAt: string): PublishedCombinedPackage {
  const byId = new Map(decisions.map((decision) => [decision.candidateId, decision]));
  if (byId.size !== draft.candidates.length || draft.candidates.some((candidate) => !byId.has(candidate.id))) throw new Error('Publishing requires an explicit review decision for every sanitary candidate.');
  if (decisions.some((decision) => !decision.reviewer.trim())) throw new Error('Every sanitary decision must identify the reviewer.');
  const approved = draft.candidates.filter((candidate) => byId.get(candidate.id)?.decision === 'approved');
  const rejected = draft.candidates.filter((candidate) => byId.get(candidate.id)?.decision === 'rejected');
  const sanitaryLines: UtilityLine[] = approved.filter((candidate) => candidate.kind === 'sewer_pipe').map((candidate) => ({
    id: `${candidate.id}-line`, layerId: 'sanitary', label: `${candidate.values.pipeSize} ${candidate.values.material}`, points: candidate.linePoints!, provenance: candidate.provenance,
  }));
  const { packageVersion: _version, contentHash: _hash, review, sourceLedger, ...baseCore } = base;
  void _version;
  void _hash;
  const core = {
    ...baseCore, publishedAt, projectName: 'Reading Public Library — Approved Field Layers',
    packageVersion: 'reading-public-library-grading-sanitary-v2' as const,
    layers: [...base.layers, { id: 'sanitary', name: 'Sanitary', color: '#7c3aed', defaultVisible: true }],
    objects: [...base.objects, ...approved.map(candidateToObject)], utilities: [...base.utilities, ...sanitaryLines],
    reviews: { grading: review, sanitary: { reviewer: decisions[0]?.reviewer ?? 'Unknown reviewer', approvedCandidateIds: approved.map((candidate) => candidate.id), rejectedCandidateIds: rejected.map((candidate) => candidate.id) } },
    sourceLedger: [sourceLedger, { fileName: '25020-RPL_Bid_Drawings_2025_07_11.pdf' as const, sha256: draft.sourceSha256, sheet: 'Topographic Survey' as const, pdfPage: 2 as const, authority: 'survey' as const, status: 'reference-derived' as const }],
    limitations: [...base.limitations, ...draft.limitations],
  };
  return deepFreeze({ ...core, contentHash: hashText(JSON.stringify(core)) }) as PublishedCombinedPackage;
}
