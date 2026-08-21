import { Calculator, CloudDownload, Crosshair, FileUp, Upload } from 'lucide-react';
import { OVERVIEW_PHASE_ID, type ExcavationLayer, type JobsitePhase } from '../types/jobsite';
import { formatFeet } from '../utils/distance';

type LeftSidebarProps = {
  phases: JobsitePhase[];
  activePhaseId: string;
  onSelectPhase: (phaseId: string) => void;
  phaseProgress: { completed: number; total: number };
  layers: ExcavationLayer[];
  visibility: Record<string, boolean>;
  onToggleLayer: (layerId: string) => void;
  onDownload: () => void;
  downloading: boolean;
  offlineReady: boolean;
  onMyLocation: () => void;
  onQuickCalculator: () => void;
  distanceFt: number | null;
  bearing: string | null;
  isSignedIn: boolean;
  hasActiveProject: boolean;
  onUploadPlan: () => void;
  onImportCivilPlan: () => void;
  importedPlanName?: string | null;
  onOpenModelStudio?: () => void;
};

export function LeftSidebar({
  phases,
  activePhaseId,
  onSelectPhase,
  phaseProgress,
  layers,
  visibility,
  onToggleLayer,
  onDownload,
  downloading,
  offlineReady,
  onMyLocation,
  onQuickCalculator,
  distanceFt,
  bearing,
  isSignedIn,
  hasActiveProject,
  onUploadPlan,
  onImportCivilPlan,
  importedPlanName,
  onOpenModelStudio,
}: LeftSidebarProps) {
  const activePhase = phases.find((p) => p.id === activePhaseId);
  const isOverview = activePhaseId === OVERVIEW_PHASE_ID;

  return (
    <aside className="left-sidebar">
      <section className="sidebar-section">
        <h2 className="sidebar-heading">Phase</h2>
        <select
          className="phase-select"
          value={activePhaseId}
          onChange={(e) => onSelectPhase(e.target.value)}
          aria-label="Select excavation phase"
        >
          {phases.map((phase) => (
            <option key={phase.id} value={phase.id}>
              {phase.name}
            </option>
          ))}
          <option value={OVERVIEW_PHASE_ID}>★ Finished Site Overview</option>
        </select>
        {isOverview ? (
          <p className="phase-summary phase-summary--overview">
            Complete as-built layout — every phase&apos;s work shown together so you can see
            where everything ends up in the finished site.
          </p>
        ) : (
          activePhase?.summary && <p className="phase-summary">{activePhase.summary}</p>
        )}

        {phaseProgress.total > 0 && (
          <div className="phase-progress">
            <div className="phase-progress__bar">
              <div
                className="phase-progress__fill"
                style={{ width: `${(phaseProgress.completed / phaseProgress.total) * 100}%` }}
              />
            </div>
            <span className="phase-progress__label">
              {phaseProgress.completed} of {phaseProgress.total} marked done
            </span>
          </div>
        )}
      </section>

      <section className="sidebar-section">
        <h2 className="sidebar-heading">Layers</h2>
        <ul className="layer-list">
          {layers.map((layer) => (
            <li key={layer.id}>
              <label className="layer-item">
                <input
                  type="checkbox"
                  checked={visibility[layer.id] ?? true}
                  onChange={() => onToggleLayer(layer.id)}
                />
                <span className="layer-dot" style={{ backgroundColor: layer.color }} />
                {layer.name}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="sidebar-section sidebar-actions">
        <button type="button" className="btn btn--primary" onClick={onImportCivilPlan}>
          <FileUp size={16} />
          Import Civil Plans
        </button>
        {importedPlanName && (
          <p className="sidebar-imported-plan">Base sheet: {importedPlanName}</p>
        )}
        {onOpenModelStudio && (
          <button type="button" className="btn btn--secondary" onClick={onOpenModelStudio}>
            Open Model Studio
          </button>
        )}
        <button
          type="button"
          className="btn btn--primary"
          onClick={onDownload}
          disabled={downloading || offlineReady}
        >
          <CloudDownload size={16} />
          {downloading ? 'Downloading…' : offlineReady ? 'Plans Downloaded' : 'Download Jobsite Plans'}
        </button>
        <button type="button" className="btn btn--secondary" onClick={onMyLocation}>
          <Crosshair size={16} />
          My Location on Plan
        </button>
        <button type="button" className="btn btn--secondary" onClick={onQuickCalculator}>
          <Calculator size={16} />
          Quick Calculator
        </button>

        {isSignedIn && hasActiveProject ? (
          <button type="button" className="btn btn--secondary" onClick={onUploadPlan}>
            <Upload size={16} />
            Upload Plan PDF
          </button>
        ) : (
          <p className="sidebar-upload-hint">
            {!isSignedIn
              ? 'Sign in (person icon ↑) to upload plan PDFs.'
              : 'Select a project above to upload plans.'}
          </p>
        )}
      </section>

      <div className="distance-footer">
        <span className="distance-footer__label">Distance to selected object:</span>
        <span className="distance-footer__value">
          {distanceFt !== null ? formatFeet(distanceFt) : '—'}
        </span>
        {bearing && distanceFt !== null && (
          <span className="distance-footer__bearing">Direction: {bearing}</span>
        )}
      </div>
    </aside>
  );
}
