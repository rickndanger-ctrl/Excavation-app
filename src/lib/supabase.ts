import { createClient } from '@supabase/supabase-js';
import {
  parseSemanticPublication,
  type ParsedSemanticPublication,
  type SemanticPublicationEnvelope,
} from './semanticPublication';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const semanticPublicationSyncConfigured =
  supabaseConfigured && import.meta.env.VITE_SEMANTIC_PUBLICATIONS_ENABLED === 'true';

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

// ─── Types mirroring the DB schema ───────────────────────────────────────────

export type Project = {
  id: string;
  name: string;
  created_at: string;
};

export type PlanSheet = {
  id: string;
  project_id: string;
  name: string;
  sheet_type: string | null;
  storage_path: string;
  display_order: number;
  created_at: string;
  public_url?: string;
};

type SemanticPublicationRow = {
  package_id: string;
  package_version: string;
  content_sha256: string;
  package_created_at: string;
  manifest_json: string;
};

function rowEnvelope(row: SemanticPublicationRow): SemanticPublicationEnvelope {
  return {
    publication_schema: 'excavation-field-map.semantic-publication/v1',
    package_id: row.package_id,
    package_version: row.package_version,
    content_sha256: row.content_sha256,
    created_at: row.package_created_at,
    manifest_json: row.manifest_json,
  };
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

export const BUCKET = 'plan-sheets';

export function getPublicUrl(storagePath: string): string {
  if (!supabase) return '';
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

// ─── Project helpers ──────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProject(name: string): Promise<Project> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('projects')
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Sheet helpers ────────────────────────────────────────────────────────────

export async function fetchSheets(projectId: string): Promise<PlanSheet[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('plan_sheets')
    .select('*')
    .eq('project_id', projectId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((s) => ({ ...s, public_url: getPublicUrl(s.storage_path) }));
}

export async function uploadSheet(
  projectId: string,
  file: File,
  sheetName: string,
  sheetType: string,
  displayOrder: number,
): Promise<PlanSheet> {
  if (!supabase) throw new Error('Supabase not configured');

  const ext = file.name.split('.').pop() ?? 'png';
  const sheetId = crypto.randomUUID();
  const storagePath = `${projectId}/${sheetId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: dbError } = await supabase
    .from('plan_sheets')
    .insert({
      id: sheetId,
      project_id: projectId,
      name: sheetName,
      sheet_type: sheetType || null,
      storage_path: storagePath,
      display_order: displayOrder,
    })
    .select()
    .single();
  if (dbError) throw dbError;

  return { ...data, public_url: getPublicUrl(storagePath) };
}

export async function deleteSheet(sheet: PlanSheet): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  await supabase.storage.from(BUCKET).remove([sheet.storage_path]);
  await supabase.from('plan_sheets').delete().eq('id', sheet.id);
}

// ─── Immutable semantic publication helpers ─────────────────────────────────

export async function fetchSemanticPublications(): Promise<SemanticPublicationEnvelope[]> {
  if (!supabase || !semanticPublicationSyncConfigured) return [];
  const { data, error } = await supabase
    .from('semantic_package_publications')
    .select('package_id,package_version,content_sha256,package_created_at,manifest_json')
    .order('package_created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowEnvelope(row as SemanticPublicationRow));
}

export async function publishSemanticPublicationRemote(
  fieldProjectId: string,
  input: unknown,
): Promise<{ status: 'published' | 'already_published'; publication: ParsedSemanticPublication }> {
  if (!supabase || !semanticPublicationSyncConfigured) {
    throw new Error('Remote semantic publication is not configured.');
  }
  const publication = await parseSemanticPublication(input);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('An authenticated manager is required to publish a semantic package.');

  const { error } = await supabase.from('semantic_package_publications').insert({
    field_project_id: fieldProjectId,
    package_id: publication.envelope.package_id,
    package_version: publication.envelope.package_version,
    content_sha256: publication.envelope.content_sha256,
    package_created_at: publication.envelope.created_at,
    manifest_json: publication.envelope.manifest_json,
    published_by: authData.user.id,
  });
  if (!error) return { status: 'published', publication };
  if (error.code !== '23505') throw error;

  const { data: existing, error: fetchError } = await supabase
    .from('semantic_package_publications')
    .select('package_id,package_version,content_sha256,package_created_at,manifest_json')
    .eq('package_id', publication.envelope.package_id)
    .eq('package_version', publication.envelope.package_version)
    .single();
  if (fetchError) throw fetchError;
  const prior = await parseSemanticPublication(rowEnvelope(existing as SemanticPublicationRow));
  if (prior.envelope.content_sha256 !== publication.envelope.content_sha256) {
    throw new Error(`Immutable publication conflict for ${publication.identity}. Use a new package_version for changed content.`);
  }
  return { status: 'already_published', publication: prior };
}
