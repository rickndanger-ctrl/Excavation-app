import { useMemo, useState } from 'react';
import type { WaterDraft, WaterReviewDecision } from '../lib/waterPipeline';

type Props = { draft: WaterDraft; onClose: () => void; onPublish: (decisions: WaterReviewDecision[]) => void };
export function WaterStudio({ draft, onClose, onPublish }: Props) {
  const [reviewer, setReviewer] = useState('');
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'rejected'>>({});
  const complete = useMemo(() => reviewer.trim().length > 0 && draft.candidates.every((candidate) => decisions[candidate.id]), [decisions, draft.candidates, reviewer]);
  return <section className="model-studio water-studio" aria-label="Water Studio review">
    <header className="model-studio__header"><div><p className="model-studio__eyebrow">Master control center · Water</p><h1>Water Studio</h1><p>{draft.candidates.length} water-gate candidates</p></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close Water Studio">×</button></header>
    <div className="model-studio__warning"><strong>NOT FOR CONSTRUCTION STAKING</strong><span>{draft.limitations.join(' ')}</span></div>
    <div className="model-studio__source"><strong>Source locked</strong><span>{draft.sheet} · PDF page {draft.pdfPage}</span><code>{draft.sourceSha256.slice(0, 12)}…</code></div>
    <div className="water-studio__symbols" aria-label="Water symbol legend"><span data-symbol="water-gate">◇ WG · Water gate</span></div>
    <section><h2>Excluded from water</h2>{draft.excludedEvidence.map((item) => <p className="water-studio__excluded" key={item.source}>{item.source} — {item.reason}</p>)}</section>
    <div className="model-studio__candidates">{draft.candidates.map((candidate) => <article className="model-studio__candidate water-studio__candidate" data-kind={candidate.kind} key={candidate.id}>
      <div className="model-studio__candidate-main"><span className="confidence confidence--medium">medium confidence</span><strong>{candidate.label}</strong><small>Manual vector review · visible WG point symbol</small></div>
      <fieldset><legend>Reviewer decision</legend><label><input type="radio" name={candidate.id} aria-label="Approve" checked={decisions[candidate.id] === 'approved'} onChange={() => setDecisions((current) => ({ ...current, [candidate.id]: 'approved' }))} />Approve</label><label><input type="radio" name={candidate.id} aria-label="Reject" checked={decisions[candidate.id] === 'rejected'} onChange={() => setDecisions((current) => ({ ...current, [candidate.id]: 'rejected' }))} />Reject</label></fieldset>
    </article>)}</div>
    <footer className="model-studio__publish"><label>Water reviewer name<input aria-label="Water reviewer name" value={reviewer} onChange={(event) => setReviewer(event.target.value)} /></label><p>{Object.keys(decisions).length} of {draft.candidates.length} decisions recorded</p><button type="button" className="btn btn--primary" disabled={!complete} onClick={() => onPublish(draft.candidates.map((candidate) => ({ candidateId: candidate.id, decision: decisions[candidate.id], reviewer: reviewer.trim() })))}>Publish approved water layer</button></footer>
  </section>;
}
