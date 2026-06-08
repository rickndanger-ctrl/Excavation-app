import { useCallback, useEffect, useState } from 'react';
import {
  type PlanSheet,
  type Project,
  createProject,
  fetchProjects,
  fetchSheets,
} from '../lib/supabase';

const ACTIVE_PROJECT_KEY = 'excavation-field-map:activeProjectId';
const ACTIVE_SHEET_KEY = 'excavation-field-map:activeSheetId';

export type ProjectsState = {
  projects: Project[];
  activeProject: Project | null;
  sheets: PlanSheet[];
  activeSheet: PlanSheet | null;
  loading: boolean;
  error: string | null;
  selectProject: (project: Project | null) => void;
  selectSheet: (sheet: PlanSheet | null) => void;
  addProject: (name: string) => Promise<Project>;
  reload: () => Promise<void>;
};

export function useProjects(): ProjectsState {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [sheets, setSheets] = useState<PlanSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState<PlanSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchProjects();
      setProjects(list);

      // Restore persisted active project, or auto-select the first one on first load
      const savedProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY);
      const restored = list.find((p) => p.id === savedProjectId) ?? list[0] ?? null;
      if (restored && !savedProjectId) localStorage.setItem(ACTIVE_PROJECT_KEY, restored.id);
      setActiveProject(restored);

      if (restored) {
        const sheetList = await fetchSheets(restored.id);
        setSheets(sheetList);
        const savedSheetId = localStorage.getItem(ACTIVE_SHEET_KEY);
        setActiveSheet(sheetList.find((s) => s.id === savedSheetId) ?? sheetList[0] ?? null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load projects';
      console.error('[useProjects] Supabase error:', msg, e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProjects();
  }, [loadProjects]);

  const selectProject = useCallback(async (project: Project | null) => {
    setActiveProject(project);
    setActiveSheet(null);
    setSheets([]);

    if (project) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
      localStorage.removeItem(ACTIVE_SHEET_KEY);
      try {
        const sheetList = await fetchSheets(project.id);
        setSheets(sheetList);
        setActiveSheet(sheetList[0] ?? null);
        if (sheetList[0]) localStorage.setItem(ACTIVE_SHEET_KEY, sheetList[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load sheets');
      }
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
      localStorage.removeItem(ACTIVE_SHEET_KEY);
    }
  }, []);

  const selectSheet = useCallback((sheet: PlanSheet | null) => {
    setActiveSheet(sheet);
    if (sheet) {
      localStorage.setItem(ACTIVE_SHEET_KEY, sheet.id);
    } else {
      localStorage.removeItem(ACTIVE_SHEET_KEY);
    }
  }, []);

  const addProject = useCallback(async (name: string): Promise<Project> => {
    const project = await createProject(name);
    setProjects((prev) => [project, ...prev]);
    return project;
  }, []);

  return {
    projects,
    activeProject,
    sheets,
    activeSheet,
    loading,
    error,
    selectProject,
    selectSheet,
    addProject,
    reload: loadProjects,
  };
}
