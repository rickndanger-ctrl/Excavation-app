import type { BlueprintObject, JobsitePackage, Point } from '../types/jobsite';
import type { PdfPageGeometry, PdfTextGeometry } from './pdfPlanGeometry';

export type GradingCandidateKind = 'spot_elevation' | 'wall_elevation_pair' | 'slope' | 'rim_adjustment' | 'grading_note';

export type GradingCandidate = {
  id: string;
  kind: GradingCandidateKind;
  label: string;
  confidence: 'high' | 'medium';
  planPoint: Point;
  values: { elevationFt?: number; bottomWallFt?: number; topWallFt?: number; slopePercent?: number };
  provenance: {
    sourceSha256: string;
    sheet: 'L2.1';
    pdfPage: 6;
    sourceItemIndexes: number[];
    sourceText: string[];
    extraction: 'native_pdf_text';
    status: 'reference-derived';
  };
};

export type GradingReviewDraft = {
  projectId: 'reading-public-library';
  sheet: 'L2.1';
  pdfPage: 6;
  sourceSha256: string;
  sourceFileName: '25020-RPL_Bid_Drawings_2025_07_11.pdf';
  candidates: GradingCandidate[];
  limitations: string[];
};

export type GradingReviewDecision = { candidateId: string; decision: 'approved' | 'rejected'; reviewer: string };

export type PublishedGradingPackage = JobsitePackage & {
  packageVersion: 'reading-public-library-l2.1-grading-v1';
  contentHash: string;
  immutable: true;
  sourceIncluded: false;
  publishedAt: string;
  review: { reviewer: string; approvedCandidateIds: string[]; rejectedCandidateIds: string[] };
  sourceLedger: {
    fileName: GradingReviewDraft['sourceFileName'];
    sha256: string;
    sheet: 'L2.1';
    pdfPage: 6;
    authority: 'bid_document';
    status: 'reference-derived';
  };
  limitations: string[];
};

const PLAN_REGION = { minX: 500, maxX: 1000, minY: 850, maxY: 1600 } as const;
export const READING_PLAN_SHA256 = '835e28d8d981b4c0a0c5840e006c4cc19f259fc7fcb218ddc744bfec97da97d1';

function inPlanRegion(text: PdfTextGeometry): boolean {
  const [, , , , x, y] = text.sourceTransform;
  return x >= PLAN_REGION.minX && x <= PLAN_REGION.maxX && y >= PLAN_REGION.minY && y <= PLAN_REGION.maxY;
}

function toPlanPoint(text: PdfTextGeometry): Point {
  const [, , , , sourceX, sourceY] = text.sourceTransform;
  const reviewWidth = 120;
  const reviewHeight = 80;
  const margin = 5;
  return {
    x: Number((margin + ((sourceY - PLAN_REGION.minY) / (PLAN_REGION.maxY - PLAN_REGION.minY)) * (reviewWidth - margin * 2)).toFixed(3)),
    y: Number((margin + ((PLAN_REGION.maxX - sourceX) / (PLAN_REGION.maxX - PLAN_REGION.minX)) * (reviewHeight - margin * 2)).toFixed(3)),
  };
}

function makeProvenance(texts: PdfTextGeometry[], sourceSha256: string): GradingCandidate['provenance'] {
  return {
    sourceSha256,
    sheet: 'L2.1',
    pdfPage: 6,
    sourceItemIndexes: texts.map((text) => text.sourceItemIndex),
    sourceText: texts.map((text) => text.text),
    extraction: 'native_pdf_text',
    status: 'reference-derived',
  };
}

function candidateId(kind: GradingCandidateKind, text: PdfTextGeometry): string {
  return `l2.1-${kind}-${text.sourceItemIndex}`;
}

function sequence(texts: PdfTextGeometry[], start: number, end: number): PdfTextGeometry[] {
  return texts.filter((text) => text.sourceItemIndex >= start && text.sourceItemIndex <= end);
}

export function buildReadingL21Draft(geometry: PdfPageGeometry, sourceSha256: string): GradingReviewDraft {
  if (sourceSha256 !== READING_PLAN_SHA256) {
    throw new Error('The source checksum does not match the locked Reading Public Library bid set.');
  }
  if (geometry.pageNumber !== 6 || !geometry.texts.some((text) => text.text.trim() === 'L2.1')) {
    throw new Error('The selected source page is not Reading Public Library sheet L2.1.');
  }
  const planTexts = geometry.texts.filter(inPlanRegion);
  const candidates: GradingCandidate[] = [];

  for (const text of planTexts) {
    const value = text.text.trim();
    if (/^\d{3}\.\d{2}$/.test(value)) {
      candidates.push({
        id: candidateId('spot_elevation', text), kind: 'spot_elevation', label: `Spot elevation ${value}`,
        confidence: 'high', planPoint: toPlanPoint(text), values: { elevationFt: Number(value) },
        provenance: makeProvenance([text], sourceSha256),
      });
    } else if (/^\d+(?:\.\d+)?%$/.test(value)) {
      candidates.push({
        id: candidateId('slope', text), kind: 'slope', label: `Slope ${value}`,
        confidence: 'high', planPoint: toPlanPoint(text), values: { slopePercent: Number(value.slice(0, -1)) },
        provenance: makeProvenance([text], sourceSha256),
      });
    }
  }

  for (const bottom of planTexts.filter((text) => /^BW \d{3}\.\d{2}$/.test(text.text.trim()))) {
    const top = planTexts.find((text) => text.sourceItemIndex > bottom.sourceItemIndex
      && text.sourceItemIndex <= bottom.sourceItemIndex + 2 && /^TW \d{3}\.\d{2}$/.test(text.text.trim()));
    if (!top) continue;
    const bottomValue = Number(bottom.text.trim().slice(3));
    const topValue = Number(top.text.trim().slice(3));
    candidates.push({
      id: candidateId('wall_elevation_pair', bottom), kind: 'wall_elevation_pair',
      label: `Wall BW ${bottomValue.toFixed(2)} / TW ${topValue.toFixed(2)}`, confidence: 'high',
      planPoint: toPlanPoint(bottom), values: { bottomWallFt: bottomValue, topWallFt: topValue },
      provenance: makeProvenance([bottom, top], sourceSha256),
    });
  }

  const notes = [
    { start: 65, end: 66, kind: 'rim_adjustment' as const, label: 'Lower existing cleanout rim to 155.29', elevationFt: 155.29, confidence: 'high' as const },
    { start: 73, end: 75, kind: 'rim_adjustment' as const, label: 'Raise existing DMH rim to 155.00', elevationFt: 155, confidence: 'high' as const },
    { start: 68, end: 71, kind: 'grading_note' as const, label: 'Provide flush transition between existing and proposed pavement', confidence: 'medium' as const },
    { start: 80, end: 83, kind: 'grading_note' as const, label: 'Adjust existing shrub elevations as directed by landscape architect', confidence: 'medium' as const },
  ];
  for (const definition of notes) {
    const sourceTexts = sequence(geometry.texts, definition.start, definition.end);
    if (sourceTexts.length !== definition.end - definition.start + 1) continue;
    const anchor = sourceTexts[0];
    candidates.push({
      id: candidateId(definition.kind, anchor), kind: definition.kind, label: definition.label,
      confidence: definition.confidence, planPoint: toPlanPoint(anchor),
      values: 'elevationFt' in definition ? { elevationFt: definition.elevationFt } : {},
      provenance: makeProvenance(sourceTexts, sourceSha256),
    });
  }

  const spatialCandidates = candidates.filter((candidate) => candidate.kind !== 'grading_note');
  const minX = Math.min(...spatialCandidates.map((candidate) => candidate.planPoint.x));
  const maxX = Math.max(...spatialCandidates.map((candidate) => candidate.planPoint.x));
  const minY = Math.min(...spatialCandidates.map((candidate) => candidate.planPoint.y));
  const maxY = Math.max(...spatialCandidates.map((candidate) => candidate.planPoint.y));
  for (const candidate of candidates) {
    candidate.planPoint = {
      x: Number(Math.min(111, Math.max(9, 9 + ((candidate.planPoint.x - minX) / (maxX - minX)) * 102)).toFixed(3)),
      y: Number(Math.min(71, Math.max(9, 9 + ((candidate.planPoint.y - minY) / (maxY - minY)) * 62)).toFixed(3)),
    };
  }

  candidates.sort((a, b) => a.provenance.sourceItemIndexes[0] - b.provenance.sourceItemIndexes[0]);
  return {
    projectId: 'reading-public-library', sheet: 'L2.1', pdfPage: 6, sourceSha256,
    sourceFileName: '25020-RPL_Bid_Drawings_2025_07_11.pdf', candidates,
    limitations: [
      'Reference-derived from native PDF text; not surveyed or construction-authorized.',
      'Contour lines and leader-line associations are not yet semantically traced.',
      'Candidate positions are sheet-space review locations, not calibrated field coordinates.',
    ],
  };
}

function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function candidateToObject(candidate: GradingCandidate): BlueprintObject {
  const type = candidate.kind === 'slope' ? 'slope_marker' : candidate.kind === 'wall_elevation_pair' ? 'grade_break' : 'elevation';
  const workerLabel = candidate.kind === 'spot_elevation'
    ? candidate.values.elevationFt!.toFixed(2)
    : candidate.kind === 'slope'
      ? `${candidate.values.slopePercent}%`
      : candidate.kind === 'wall_elevation_pair'
        ? `BW ${candidate.values.bottomWallFt!.toFixed(2)} / TW ${candidate.values.topWallFt!.toFixed(2)}`
        : candidate.label.includes('cleanout')
          ? `CO rim ${candidate.values.elevationFt!.toFixed(2)}`
          : candidate.label.includes('DMH')
            ? `DMH rim ${candidate.values.elevationFt!.toFixed(2)}`
            : candidate.label.slice(0, 24);
  return {
    id: candidate.id, type, layerId: 'grading', x: candidate.planPoint.x, y: candidate.planPoint.y,
    label: candidate.label, workerLabel, elevation: candidate.values.elevationFt?.toFixed(2),
    slope: candidate.values.slopePercent === undefined ? undefined : `${candidate.values.slopePercent}%`,
    blueprintSheet: 'L2.1', confidence: candidate.confidence, provenance: candidate.provenance,
    notes: 'Reference-derived candidate approved by a human reviewer. Verify against current contract documents and field control before use.',
  };
}

export function publishApprovedGradingPackage(
  draft: GradingReviewDraft,
  decisions: GradingReviewDecision[],
  publishedAt: string,
): PublishedGradingPackage {
  const byCandidate = new Map(decisions.map((decision) => [decision.candidateId, decision]));
  if (byCandidate.size !== draft.candidates.length || draft.candidates.some((candidate) => !byCandidate.has(candidate.id))) {
    throw new Error('Publishing requires an explicit review decision for every candidate.');
  }
  if (decisions.some((decision) => !decision.reviewer.trim())) throw new Error('Every review decision must identify the reviewer.');
  const approved = draft.candidates.filter((candidate) => byCandidate.get(candidate.id)?.decision === 'approved');
  const rejected = draft.candidates.filter((candidate) => byCandidate.get(candidate.id)?.decision === 'rejected');
  const core = {
    id: 'reading-public-library-l2.1-grading', projectName: 'Reading Public Library — Approved Grading Layer',
    packageVersion: 'reading-public-library-l2.1-grading-v1' as const, immutable: true as const, sourceIncluded: false as const,
    publishedAt, phases: [{ id: 'grading-review', name: 'Reviewed grading', summary: 'Human-reviewed sheet L2.1 grading annotations.' }],
    plan: { imageUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%2280%22%3E%3Crect width=%22120%22 height=%2280%22 fill=%22%23f7f4ec%22/%3E%3C/svg%3E', widthFt: 120, heightFt: 80 },
    layers: [{ id: 'grading', name: 'Grading', color: '#d97706', defaultVisible: true }],
    objects: approved.map(candidateToObject), utilities: [], userLocation: { x: 60, y: 40 }, userHeading: 0, calibrationPoints: [],
    review: { reviewer: decisions[0]?.reviewer ?? 'Unknown reviewer', approvedCandidateIds: approved.map((c) => c.id), rejectedCandidateIds: rejected.map((c) => c.id) },
    sourceLedger: { fileName: draft.sourceFileName, sha256: draft.sourceSha256, sheet: draft.sheet, pdfPage: draft.pdfPage, authority: 'bid_document' as const, status: 'reference-derived' as const },
    limitations: draft.limitations,
  };
  return deepFreeze({ ...core, contentHash: hashText(JSON.stringify(core)) });
}

type PackageStorage = Pick<Storage, 'getItem' | 'setItem'>;
const ACTIVE_PACKAGE_KEY = 'excavation-field-map:semantic-package:active';

function packageKey(version: string): string {
  return `excavation-field-map:semantic-package:${version}`;
}

function verifyPackageIntegrity(published: PublishedGradingPackage): void {
  const { contentHash, ...core } = published;
  if (hashText(JSON.stringify(core)) !== contentHash) {
    throw new Error('Published grading package integrity check failed.');
  }
}

export function savePublishedGradingPackage(storage: PackageStorage, published: PublishedGradingPackage): void {
  verifyPackageIntegrity(published);
  const key = packageKey(published.packageVersion);
  const encoded = JSON.stringify(published);
  const existing = storage.getItem(key);
  if (existing !== null && existing !== encoded) {
    throw new Error(`Published package ${published.packageVersion} is immutable and cannot be overwritten.`);
  }
  if (existing === null) storage.setItem(key, encoded);
  storage.setItem(ACTIVE_PACKAGE_KEY, published.packageVersion);
}

export function loadPublishedGradingPackage(storage: PackageStorage): PublishedGradingPackage | null {
  const version = storage.getItem(ACTIVE_PACKAGE_KEY);
  if (!version) return null;
  const raw = storage.getItem(packageKey(version));
  if (!raw) return null;
  const published = JSON.parse(raw) as PublishedGradingPackage;
  verifyPackageIntegrity(published);
  return deepFreeze(published);
}
