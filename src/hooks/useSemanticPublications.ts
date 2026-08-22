import { useCallback, useEffect, useState } from 'react';
import {
  ingestSemanticPublication,
  loadSemanticPublications,
  type ParsedSemanticPublication,
} from '../lib/semanticPublication';
import { fetchSemanticPublications } from '../lib/supabase';

const ACTIVE_PUBLICATION_KEY = 'excavation-field-map:activeSemanticPublication:v1';
const LOCAL_INBOX_URL = '/semantic-publications.local.json';
const MODEL_STUDIO_FEED_URL = '/model-studio-api/publications';

export type SemanticPublicationsState = {
  publications: ParsedSemanticPublication[];
  activePublication: ParsedSemanticPublication | null;
  loading: boolean;
  error: string | null;
  selectPublication: (publication: ParsedSemanticPublication | null) => void;
  publishLocal: (input: unknown) => Promise<ParsedSemanticPublication>;
  refresh: () => Promise<void>;
};

async function localInbox(): Promise<unknown[]> {
  if (!import.meta.env.DEV) return [];
  const response = await fetch(LOCAL_INBOX_URL, { cache: 'no-store' });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Local publication inbox returned HTTP ${response.status}.`);
  const parsed = await response.json() as unknown;
  if (!Array.isArray(parsed)) throw new Error('Local publication inbox must contain a JSON array.');
  return parsed;
}

async function modelStudioInbox(): Promise<unknown[]> {
  if (!import.meta.env.DEV) return [];
  try {
    const response = await fetch(MODEL_STUDIO_FEED_URL, { cache: 'no-store' });
    if (response.status === 404 || response.status === 502) return [];
    if (!response.ok) throw new Error(`Model Studio publication feed returned HTTP ${response.status}.`);
    const parsed = await response.json() as unknown;
    if (!Array.isArray(parsed)) throw new Error('Model Studio publication feed must contain a JSON array.');
    return parsed;
  } catch (cause) {
    if (cause instanceof TypeError) return [];
    throw cause;
  }
}

export function useSemanticPublications(): SemanticPublicationsState {
  const [publications, setPublications] = useState<ParsedSemanticPublication[]>([]);
  const [activePublication, setActivePublication] = useState<ParsedSemanticPublication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cached = await loadSemanticPublications(localStorage);
      const activeIdentity = localStorage.getItem(ACTIVE_PUBLICATION_KEY);
      const cachedActive = cached.find((item) => item.identity === activeIdentity) ?? null;
      setPublications(cached);
      setActivePublication(cachedActive);
      if (cachedActive) localStorage.setItem(ACTIVE_PUBLICATION_KEY, cachedActive.identity);

      const [inbox, studio, remote] = await Promise.all([
        localInbox(), modelStudioInbox(), fetchSemanticPublications(),
      ]);
      for (const envelope of [...inbox, ...studio, ...remote]) await ingestSemanticPublication(localStorage, envelope);
      if (inbox.length === 0 && studio.length === 0 && remote.length === 0) return;
      const next = await loadSemanticPublications(localStorage);
      const active = next.find((item) => item.identity === activeIdentity) ?? null;
      setPublications(next);
      setActivePublication(active);
      if (active) localStorage.setItem(ACTIVE_PUBLICATION_KEY, active.identity);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Semantic publication sync failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Refresh is the external inbox/Supabase subscription boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refresh]);

  const selectPublication = useCallback((publication: ParsedSemanticPublication | null) => {
    setActivePublication(publication);
    if (publication) localStorage.setItem(ACTIVE_PUBLICATION_KEY, publication.identity);
    else localStorage.removeItem(ACTIVE_PUBLICATION_KEY);
  }, []);

  const publishLocal = useCallback(async (input: unknown) => {
    const result = await ingestSemanticPublication(localStorage, input);
    const next = await loadSemanticPublications(localStorage);
    setPublications(next);
    setActivePublication(result.publication);
    localStorage.setItem(ACTIVE_PUBLICATION_KEY, result.publication.identity);
    return result.publication;
  }, []);

  return { publications, activePublication, loading, error, selectPublication, publishLocal, refresh };
}
