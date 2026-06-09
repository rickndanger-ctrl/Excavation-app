import { ChevronDown, FolderOpen, LogIn, LogOut, Plus, Upload, User } from 'lucide-react';
import { useState } from 'react';
import type { AuthState } from '../hooks/useAuth';
import type { ProjectsState } from '../hooks/useProjects';
import { supabaseConfigured } from '../lib/supabase';
import { AuthModal } from './AuthModal';
import { PlanUploadPanel } from './PlanUploadPanel';

type Props = {
  auth: AuthState;
  projects: ProjectsState;
};

export function ProjectManager({ auth, projects }: Props) {
  const [showAuth, setShowAuth] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const project = await projects.addProject(newProjectName.trim());
      await projects.selectProject(project);
      setNewProjectName('');
      setShowNewProjectInput(false);
      setShowProjectMenu(false);
    } finally {
      setCreatingProject(false);
    }
  };

  const handleSheetUploaded = (sheet: import('../lib/supabase').PlanSheet) => {
    projects.reload();
    projects.selectSheet(sheet);
  };

  return (
    <>
      <div className="project-manager">
        {/* Project selector */}
        <div className="project-selector">
          <button
            type="button"
            className="project-selector__btn"
            onClick={() => setShowProjectMenu((v) => !v)}
          >
            <FolderOpen size={14} />
            <span className="project-selector__name">
              {projects.loading
                ? 'Loading…'
                : projects.activeProject?.name ?? 'Sample Data'}
            </span>
            <ChevronDown size={13} />
          </button>

          {showProjectMenu && (
            <div className="project-menu" onClick={(e) => e.stopPropagation()}>
              {/* Use sample data option */}
              <button
                type="button"
                className={`project-menu__item ${!projects.activeProject ? 'project-menu__item--active' : ''}`}
                onClick={() => {
                  projects.selectProject(null);
                  setShowProjectMenu(false);
                }}
              >
                Cedar Grove Sample
              </button>

              {projects.projects.length > 0 && <div className="project-menu__divider" />}

              {projects.projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`project-menu__item ${projects.activeProject?.id === p.id ? 'project-menu__item--active' : ''}`}
                  onClick={() => {
                    projects.selectProject(p);
                    setShowProjectMenu(false);
                  }}
                >
                  {p.name}
                </button>
              ))}

              {auth.user && (
                <>
                  <div className="project-menu__divider" />
                  {showNewProjectInput ? (
                    <form onSubmit={handleCreateProject} className="project-menu__new-form">
                      <input
                        type="text"
                        className="form-input form-input--sm"
                        placeholder="Project name"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        autoFocus
                      />
                      <button type="submit" className="btn btn--primary btn--xs" disabled={creatingProject}>
                        {creatingProject ? '…' : 'Create'}
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="project-menu__item project-menu__item--action"
                      onClick={() => setShowNewProjectInput(true)}
                    >
                      <Plus size={13} /> New Project
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Sheet tabs (only when a project is active and has sheets) */}
        {projects.activeProject && projects.sheets.length > 0 && (
          <div className="sheet-tabs">
            {projects.sheets.map((sheet) => (
              <button
                key={sheet.id}
                type="button"
                className={`sheet-tab ${projects.activeSheet?.id === sheet.id ? 'sheet-tab--active' : ''}`}
                onClick={() => projects.selectSheet(sheet)}
                title={sheet.sheet_type ?? ''}
              >
                {sheet.name}
              </button>
            ))}
          </div>
        )}

        {/* Data source indicator */}
        {supabaseConfigured && projects.error ? (
          <span className="data-source-badge data-source-badge--error" title={projects.error}>
            ● Supabase error
          </span>
        ) : (
          <span className={`data-source-badge ${supabaseConfigured ? 'data-source-badge--live' : 'data-source-badge--local'}`}>
            {projects.loading
              ? '○ Connecting…'
              : supabaseConfigured
                ? (projects.projects.length > 0 ? '● Supabase' : '● Supabase (no data)')
                : '● Local only'}
          </span>
        )}

        {/* Action buttons */}
        <div className="project-actions">
          {auth.user && projects.activeProject && (
            <button
              type="button"
              className="btn btn--sm btn--outline"
              onClick={() => setShowUpload(true)}
            >
              <Upload size={13} /> Upload
            </button>
          )}

          {auth.configured && (
            auth.user ? (
              <button
                type="button"
                className="btn btn--sm btn--signed-in"
                onClick={() => auth.signOut()}
                title="Click to sign out"
              >
                <User size={13} />
                <span className="btn-auth-label">
                  {auth.user.email ? auth.user.email.split('@')[0] : 'Signed In'}
                </span>
                <LogOut size={11} className="btn-signout-icon" />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--sm btn--sign-in"
                onClick={() => setShowAuth(true)}
              >
                <LogIn size={13} />
                Sign In
              </button>
            )
          )}
        </div>
      </div>

      {/* Close project menu on outside click */}
      {showProjectMenu && (
        <div className="backdrop-clear" onClick={() => setShowProjectMenu(false)} />
      )}

      {showAuth && <AuthModal auth={auth} onClose={() => setShowAuth(false)} />}

      {showUpload && projects.activeProject && (
        <PlanUploadPanel
          projectId={projects.activeProject.id}
          existingSheetCount={projects.sheets.length}
          onUploaded={handleSheetUploaded}
          onClose={() => setShowUpload(false)}
        />
      )}
    </>
  );
}
