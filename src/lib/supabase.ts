import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

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
