import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ForemanNote } from '../types/jobsite';
import { getForemanNotes, saveForemanNotes } from '../utils/storage';

const SEED_NOTE: ForemanNote = {
  id: 'seed-1',
  text: 'Pipe thickness OK at 200m',
  createdAt: new Date().toISOString(),
};

function formatNoteTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return isToday ? `Today, ${time}` : date.toLocaleString();
}

export function ForemanNotes() {
  const [notes, setNotes] = useState<ForemanNote[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const stored = getForemanNotes();
    const initial = stored.length === 0 ? [SEED_NOTE] : stored;
    if (stored.length === 0) saveForemanNotes(initial);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(initial);
  }, []);

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    const note: ForemanNote = {
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    saveForemanNotes(updated);
    setDraft('');
  };

  const deleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    saveForemanNotes(updated);
  };

  return (
    <section className="foreman-notes">
      <h2 className="panel-heading">Foreman Notes</h2>
      <div className="foreman-notes__input-row">
        <input
          type="text"
          placeholder="Add a field note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addNote()}
        />
        <button type="button" className="btn btn--secondary btn--sm" onClick={addNote}>
          Save
        </button>
      </div>
      <ul className="foreman-notes__list">
        {notes.map((note) => (
          <li key={note.id} className="foreman-notes__item">
            <div className="foreman-notes__item-body">
              <p>{note.text}</p>
              <time>{formatNoteTime(note.createdAt)}</time>
            </div>
            <button
              type="button"
              className="note-delete-btn"
              onClick={() => deleteNote(note.id)}
              aria-label="Delete note"
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
