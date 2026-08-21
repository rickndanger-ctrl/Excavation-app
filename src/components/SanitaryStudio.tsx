import { useMemo, useState } from 'react';
import type { SanitaryDraft, SanitaryReviewDecision } from '../lib/sanitaryPipeline';

type Props = { draft: SanitaryDraft; onClose: () => void; onPublish: (decisions: SanitaryReviewDecision[]) => void };

export function SanitaryStudio({ draft, onClose, onPublish }: Props) {
  const [reviewer, setReviewer] = useState('');
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'rejected'>>({});
  const complete = useMemo(() => reviewer.trim().length > 0 && draft.candidates.every((candidate) => decisions[candidate.id]), [decisions, draft.candidates, reviewer]);
  return (
    <section className="model-studio sanitary-studio" aria-label="Sanitary Studio review">
      <header className="model-studio__header"><div><p className="model-studio__eyebrow">Master control center · Sanitary</p><h1>Sanitary Studio</h1><p>{draft.candidates.length} sanitary candidates</p></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close Sanitary Studio">×</button></header>
      <div className="model-studio__warning"><strong>NOT FOR CONSTRUCTION</strong><span>Existing-system evidence from the signed survey. Verify utility records, field locates, and survey control.</span></div>
      <div className="model-studio__source"><strong>Source locked</strong><span>{draft.sheet} · PDF page {draft.pdfPage}</span><code>{draft.sourceSha256.slice(0, 12)}…</code></div>
      <div className="sanitary-studio__symbols" aria-label="Sanitary symbol legend">
        <span data-symbol="sanitary-manhole">Ⓢ Sewer manhole</span><span data-symbol="sanitary-cleanout">◎ Cleanout</span><span data-symbol="sanitary-pipe">━ Sewer pipe</span>
      </div>
      <section><h2>Excluded from sanitary</h2>{draft.excludedEvidence.map((evidence) => <p className="sanitary-studio__excluded" key={`${evidence.sheet}-${evidence.sourceText}`}>{evidence.sheet}: {evidence.sourceText} — {evidence.reason}</p>)}</section>
      <div className="model-studio__candidates">
        {draft.candidates.map((candidate) => <article className="model-studio__candidate sanitary-studio__candidate" data-kind={candidate.kind} key={candidate.id}>
          <div className="model-studio__candidate-main"><span className="confidence confidence--medium">medium confidence</span><strong>{candidate.label}</strong><small>Manual vector review · {candidate.provenance.sourceText.join(' / ')}</small></div>
          <fieldset><legend>Reviewer decision</legend><label><input type="radio" name={candidate.id} aria-label="Approve" checked={decisions[candidate.id] === 'approved'} onChange={() => setDecisions((current) => ({ ...current, [candidate.id]: 'approved' }))} />Approve</label><label><input type="radio" name={candidate.id} aria-label="Reject" checked={decisions[candidate.id] === 'rejected'} onChange={() => setDecisions((current) => ({ ...current, [candidate.id]: 'rejected' }))} />Reject</label></fieldset>
        </article>)}
      </div>
      <footer className="model-studio__publish"><label>Sanitary reviewer name<input aria-label="Sanitary reviewer name" value={reviewer} onChange={(event) => setReviewer(event.target.value)} /></label><p>{Object.keys(decisions).length} of {draft.candidates.length} decisions recorded</p><button type="button" className="btn btn--primary" disabled={!complete} onClick={() => onPublish(draft.candidates.map((candidate) => ({ candidateId: candidate.id, decision: decisions[candidate.id], reviewer: reviewer.trim() })))}>Publish approved sanitary layer</button></footer>
    </section>
  );
}
