import { useMemo, useState } from 'react';
import type { StormDraft, StormReviewDecision } from '../lib/stormPipeline';

type Props = { draft: StormDraft; onClose: () => void; onPublish: (decisions: StormReviewDecision[]) => void };

export function StormStudio({ draft, onClose, onPublish }: Props) {
  const [reviewer, setReviewer] = useState('');
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'rejected'>>({});
  const complete = useMemo(() => reviewer.trim().length > 0 && draft.candidates.every((candidate) => decisions[candidate.id]), [decisions, draft.candidates, reviewer]);
  return <section className="model-studio storm-studio" aria-label="Storm Studio review">
    <header className="model-studio__header"><div><p className="model-studio__eyebrow">Master control center · Storm</p><h1>Storm Studio</h1><p>{draft.candidates.length} storm structure candidates</p></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close Storm Studio">×</button></header>
    <div className="model-studio__warning"><strong>NOT FOR CONSTRUCTION</strong><span>Approximate survey surface evidence. Verify utility records, field locates, and survey control.</span></div>
    <div className="model-studio__source"><strong>Source locked</strong><span>{draft.sheet} · PDF page {draft.pdfPage}</span><code>{draft.sourceSha256.slice(0, 12)}…</code></div>
    <div className="storm-studio__symbols" aria-label="Storm symbol legend"><span data-symbol="storm-manhole">Ⓓ Drainage manhole</span><span data-symbol="storm-catch-basin">◇ Catch basin</span></div>
    <section><h2>Pipe evidence pending trace</h2>{draft.pendingPipeEvidence.map((item) => <p className="storm-studio__pending-pipe" key={item.sourceText}>{item.sourceText} — {item.reason}</p>)}</section>
    <section><h2>Excluded from storm</h2>{draft.excludedEvidence.map((item) => <p className="storm-studio__excluded" key={item.source}>{item.source} — {item.reason}</p>)}</section>
    <div className="model-studio__candidates">{draft.candidates.map((candidate) => <article className="model-studio__candidate storm-studio__candidate" data-kind={candidate.kind} key={candidate.id}>
      <div className="model-studio__candidate-main"><span className="confidence confidence--medium">medium confidence</span><strong>{candidate.label}</strong><small>Manual vector review · Reed Topographic Survey</small></div>
      <fieldset><legend>Reviewer decision</legend><label><input type="radio" name={candidate.id} aria-label="Approve" checked={decisions[candidate.id] === 'approved'} onChange={() => setDecisions((current) => ({ ...current, [candidate.id]: 'approved' }))} />Approve</label><label><input type="radio" name={candidate.id} aria-label="Reject" checked={decisions[candidate.id] === 'rejected'} onChange={() => setDecisions((current) => ({ ...current, [candidate.id]: 'rejected' }))} />Reject</label></fieldset>
    </article>)}</div>
    <footer className="model-studio__publish"><label>Storm reviewer name<input aria-label="Storm reviewer name" value={reviewer} onChange={(event) => setReviewer(event.target.value)} /></label><p>{Object.keys(decisions).length} of {draft.candidates.length} decisions recorded</p><button type="button" className="btn btn--primary" disabled={!complete} onClick={() => onPublish(draft.candidates.map((candidate) => ({ candidateId: candidate.id, decision: decisions[candidate.id], reviewer: reviewer.trim() })))}>Publish approved storm layer</button></footer>
  </section>;
}
