import { useMemo, useState } from 'react';
import type { GradingReviewDecision, GradingReviewDraft } from '../lib/gradingPipeline';

type Props = {
  draft: GradingReviewDraft;
  onClose: () => void;
  onPublish: (decisions: GradingReviewDecision[]) => void;
};

export function ModelStudio({ draft, onClose, onPublish }: Props) {
  const [reviewer, setReviewer] = useState('');
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'rejected'>>({});
  const complete = useMemo(
    () => draft.candidates.every((candidate) => decisions[candidate.id]) && reviewer.trim().length > 0,
    [decisions, draft.candidates, reviewer],
  );

  return (
    <section className="model-studio" aria-label="Model Studio grading review">
      <header className="model-studio__header">
        <div>
          <p className="model-studio__eyebrow">Master control center · Sheet {draft.sheet}</p>
          <h1>Model Studio</h1>
          <p>{draft.candidates.length} grading candidates</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close Model Studio">×</button>
      </header>

      <div className="model-studio__warning">
        <strong>NOT FOR CONSTRUCTION</strong>
        <span>Reference-derived from bid documents. Human approval does not replace survey control or licensed engineering review.</span>
      </div>

      <div className="model-studio__source">
        <strong>Source locked</strong>
        <span>{draft.sourceFileName} · Sheet {draft.sheet} · PDF page {draft.pdfPage}</span>
        <code>{draft.sourceSha256.slice(0, 12)}…</code>
      </div>

      <div className="model-studio__candidates">
        {draft.candidates.map((candidate) => (
          <article className="model-studio__candidate" data-kind={candidate.kind} key={candidate.id}>
            <div className="model-studio__candidate-main">
              <span className={`confidence confidence--${candidate.confidence}`}>{candidate.confidence} confidence</span>
              <strong>{candidate.label}</strong>
              <small>
                Native PDF text · item {candidate.provenance.sourceItemIndexes.join(', ')} · {candidate.provenance.sourceText.join(' / ')}
              </small>
            </div>
            <fieldset>
              <legend>Reviewer decision</legend>
              <label><input type="radio" name={candidate.id} aria-label="Approve" checked={decisions[candidate.id] === 'approved'} onChange={() => setDecisions((current) => ({ ...current, [candidate.id]: 'approved' }))} />Approve</label>
              <label><input type="radio" name={candidate.id} aria-label="Reject" checked={decisions[candidate.id] === 'rejected'} onChange={() => setDecisions((current) => ({ ...current, [candidate.id]: 'rejected' }))} />Reject</label>
            </fieldset>
          </article>
        ))}
      </div>

      <footer className="model-studio__publish">
        <label>
          Reviewer name
          <input aria-label="Reviewer name" value={reviewer} onChange={(event) => setReviewer(event.target.value)} />
        </label>
        <p>{Object.keys(decisions).length} of {draft.candidates.length} decisions recorded</p>
        <button type="button" className="btn btn--primary" disabled={!complete} onClick={() => onPublish(draft.candidates.map((candidate) => ({ candidateId: candidate.id, decision: decisions[candidate.id], reviewer: reviewer.trim() })))}>
          Publish approved grading layer
        </button>
      </footer>
    </section>
  );
}
