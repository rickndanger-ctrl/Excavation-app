import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ForemanNotes } from '../components/ForemanNotes';
import { LeftSidebar } from '../components/LeftSidebar';
import { ObjectDetailsPanel } from '../components/ObjectDetailsPanel';
import { ModelStudio } from '../components/ModelStudio';
import { SanitaryStudio } from '../components/SanitaryStudio';
import { StormStudio } from '../components/StormStudio';
import { WaterStudio } from '../components/WaterStudio';
import { DryUtilityStudio } from '../components/DryUtilityStudio';
import { PlanCanvas, type ImportedBasePlan } from '../components/PlanCanvas';
import { PlanUploadPanel } from '../components/PlanUploadPanel';
import { RockCalculator } from '../components/RockCalculator';
import { ProjectManager } from '../components/ProjectManager';
import { useAuth } from '../hooks/useAuth';
import { useGps } from '../hooks/useGps';
import { useJobsitePackage } from '../hooks/useJobsitePackage';
import { useLayerVisibility } from '../hooks/useLayerVisibility';
import { useObjectStatus } from '../hooks/useObjectStatus';
import { useProjects } from '../hooks/useProjects';
import { useSemanticPublications } from '../hooks/useSemanticPublications';
import { OVERVIEW_PHASE_ID, type ControlPoint } from '../types/jobsite';
import { getDocument } from 'pdfjs-dist';
import { extractPdfPageGeometry } from '../lib/pdfPlanGeometry';
import { parseSemanticJobsiteManifest } from '../lib/semanticPackageAdapter';
import { layersAvailableForPhase } from '../lib/layerAvailability';
import {
  buildReadingL21Draft,
  loadPublishedGradingPackage,
  publishApprovedGradingPackage,
  savePublishedGradingPackage,
  type GradingReviewDecision,
  type GradingReviewDraft,
  type PublishedGradingPackage,
  type StoredSemanticPackage,
} from '../lib/gradingPipeline';
import { buildReadingSanitaryDraft, publishApprovedSanitaryPackage, type SanitaryDraft, type SanitaryReviewDecision } from '../lib/sanitaryPipeline';
import { buildReadingStormDraft, publishApprovedStormPackage, type StormDraft, type StormReviewDecision } from '../lib/stormPipeline';
import { buildReadingWaterDraft, publishApprovedWaterPackage, type WaterDraft, type WaterReviewDecision } from '../lib/waterPipeline';
import { buildReadingDryUtilityDraft, publishApprovedDryUtilityPackage, type DryUtilityDraft, type DryUtilityReviewDecision } from '../lib/dryUtilityPipeline';
import { buildCalibration } from '../utils/calibration';
import { bearingLabel, distanceFeet } from '../utils/distance';
import { getCalibrationPoints, saveCalibrationPoints } from '../utils/storage';
import { Expand, Layers, Navigation, Search, X } from 'lucide-react';

export function FieldMapPage() {
  const auth = useAuth();
  const projects = useProjects();
  const semanticPublications = useSemanticPublications();
  const { offlineReady, downloading, downloadPlans, activePackage } = useJobsitePackage();
  const calcRef = useRef<HTMLElement>(null);
  const civilPlanInputRef = useRef<HTMLInputElement>(null);
  const modelPackageInputRef = useRef<HTMLInputElement>(null);

  const { setStatus, getStatus } = useObjectStatus();
  const [selectedObjectId, setSelectedObjectId] = useState('');
  const [recenterToken, setRecenterToken] = useState(0);
  const [fitPlanToken, setFitPlanToken] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSidebarUpload, setShowSidebarUpload] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [localBasePlan, setLocalBasePlan] = useState<ImportedBasePlan | null>(null);
  const [importedSemanticPackage, setImportedSemanticPackage] = useState<import('../types/jobsite').JobsitePackage | null>(null);
  const [reviewDraft, setReviewDraft] = useState<GradingReviewDraft | null>(null);
  const [modelStudioOpen, setModelStudioOpen] = useState(false);
  const [sanitaryDraft, setSanitaryDraft] = useState<SanitaryDraft | null>(null);
  const [sanitaryStudioOpen, setSanitaryStudioOpen] = useState(false);
  const [stormDraft, setStormDraft] = useState<StormDraft | null>(null);
  const [stormStudioOpen, setStormStudioOpen] = useState(false);
  const [waterDraft, setWaterDraft] = useState<WaterDraft | null>(null);
  const [waterStudioOpen, setWaterStudioOpen] = useState(false);
  const [dryUtilityDraft, setDryUtilityDraft] = useState<DryUtilityDraft | null>(null);
  const [dryUtilityStudioOpen, setDryUtilityStudioOpen] = useState(false);
  const [publishedPackage, setPublishedPackage] = useState<StoredSemanticPackage | null>(() => {
    try { return loadPublishedGradingPackage(localStorage); } catch { return null; }
  });
  const [publishedNotice, setPublishedNotice] = useState<string | null>(null);
  const displayPackage = semanticPublications.activePublication?.jobsite
    ?? importedSemanticPackage
    ?? publishedPackage
    ?? activePackage;
  const { visibility, toggleLayer, isVisible } = useLayerVisibility(displayPackage.layers);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const storedBasePlan = useMemo<ImportedBasePlan | null>(() => {
    const sheet = projects.activeSheet;
    if (!sheet?.public_url) return null;
    return {
      url: sheet.public_url,
      name: sheet.name,
      mimeType: /\.pdf$/i.test(sheet.storage_path) ? 'application/pdf' : 'image/*',
    };
  }, [projects.activeSheet]);
  const importedBasePlan = localBasePlan ?? storedBasePlan;

  useEffect(() => () => {
    if (localBasePlan?.url.startsWith('blob:')) URL.revokeObjectURL(localBasePlan.url);
  }, [localBasePlan]);

  const importCivilPlan = useCallback((file: File | undefined) => {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) return;
    setLocalBasePlan((previous) => {
      if (previous?.url.startsWith('blob:')) URL.revokeObjectURL(previous.url);
      return { url: URL.createObjectURL(file), name: file.name, mimeType: 'application/pdf' };
    });
    setSelectedObjectId('');
    setFitPlanToken((token) => token + 1);
    setDrawerOpen(false);
    setPublishedNotice(null);
    void file.arrayBuffer().then(async (buffer) => {
      const digest = await crypto.subtle.digest('SHA-256', buffer.slice(0));
      const sourceSha256 = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0')).join('');
      const document = await getDocument({ data: new Uint8Array(buffer) }).promise;
      try {
        const [gradingPage, sanitaryPage] = await Promise.all([document.getPage(6), document.getPage(2)]);
        const [gradingGeometry, sanitaryGeometry] = await Promise.all([
          extractPdfPageGeometry(document, gradingPage), extractPdfPageGeometry(document, sanitaryPage),
        ]);
        setReviewDraft(buildReadingL21Draft(gradingGeometry, sourceSha256));
        setSanitaryDraft(buildReadingSanitaryDraft(sanitaryGeometry, sourceSha256));
        setStormDraft(buildReadingStormDraft(sanitaryGeometry, sourceSha256));
        setWaterDraft(buildReadingWaterDraft(sanitaryGeometry, sourceSha256));
        setDryUtilityDraft(buildReadingDryUtilityDraft(sanitaryGeometry, sourceSha256));
      } finally {
        await document.destroy();
      }
    }).catch(() => setReviewDraft(null));
  }, []);

  const importModelPackage = useCallback((file: File | undefined) => {
    if (!file) return;
    void file.text().then(async (text) => {
      const input = JSON.parse(text) as unknown;
      if (input && typeof input === 'object' && 'publication_schema' in input) {
        const publication = await semanticPublications.publishLocal(input);
        setImportedSemanticPackage(null);
        setPublishedPackage(null);
        setSelectedObjectId('');
        setFitPlanToken((token) => token + 1);
        setPublishedNotice(`${publication.jobsite.projectName} · ${publication.envelope.package_version} · checksum verified · offline ready`);
        setDrawerOpen(false);
        return;
      }
      const parsed = parseSemanticJobsiteManifest(input);
      semanticPublications.selectPublication(null);
      setImportedSemanticPackage(parsed);
      setPublishedPackage(null);
      setSelectedObjectId('');
      setFitPlanToken((token) => token + 1);
      setPublishedNotice(`${parsed.projectName} · ${parsed.objects.length} semantic features · ${parsed.disclaimer}`);
      setDrawerOpen(false);
    }).catch((error: unknown) => {
      setPublishedNotice(`Model package rejected: ${error instanceof Error ? error.message : 'invalid JSON'}`);
    });
  }, [semanticPublications]);

  const publishGrading = useCallback((decisions: GradingReviewDecision[]) => {
    if (!reviewDraft) return;
    const published = publishApprovedGradingPackage(reviewDraft, decisions, new Date().toISOString());
    savePublishedGradingPackage(localStorage, published);
    setPublishedPackage(published);
    setLocalBasePlan(null);
    setReviewDraft(null);
    setModelStudioOpen(false);
    setPublishedNotice(`Version ${published.packageVersion} · ${published.objects.length} approved features · offline ready`);
    setSelectedObjectId('');
  }, [reviewDraft]);

  const publishSanitary = useCallback((decisions: SanitaryReviewDecision[]) => {
    if (!sanitaryDraft || publishedPackage?.packageVersion !== 'reading-public-library-l2.1-grading-v1') return;
    const published = publishApprovedSanitaryPackage(publishedPackage as PublishedGradingPackage, sanitaryDraft, decisions, new Date().toISOString());
    savePublishedGradingPackage(localStorage, published);
    setPublishedPackage(published);
    setLocalBasePlan(null);
    setReviewDraft(null);
    setSanitaryDraft(null);
    setSanitaryStudioOpen(false);
    setPublishedNotice(`Version ${published.packageVersion} · ${published.objects.filter((object) => object.layerId === 'sanitary').length} approved sanitary features · offline ready`);
    setSelectedObjectId('');
  }, [publishedPackage, sanitaryDraft]);

  const publishStorm = useCallback((decisions: StormReviewDecision[]) => {
    if (!stormDraft || publishedPackage?.packageVersion !== 'reading-public-library-grading-sanitary-v2') return;
    const published = publishApprovedStormPackage(publishedPackage as import('../lib/sanitaryPipeline').PublishedCombinedPackage, stormDraft, decisions, new Date().toISOString());
    savePublishedGradingPackage(localStorage, published);
    setPublishedPackage(published);
    setLocalBasePlan(null);
    setReviewDraft(null);
    setSanitaryDraft(null);
    setStormDraft(null);
    setStormStudioOpen(false);
    setPublishedNotice(`Version ${published.packageVersion} · ${published.objects.filter((object) => object.layerId === 'storm').length} approved storm structures · offline ready`);
    setSelectedObjectId('');
  }, [publishedPackage, stormDraft]);

  const publishWater = useCallback((decisions: WaterReviewDecision[]) => {
    if (!waterDraft || publishedPackage?.packageVersion !== 'reading-public-library-grading-sanitary-storm-v3') return;
    const published = publishApprovedWaterPackage(publishedPackage as import('../lib/stormPipeline').PublishedStormPackage, waterDraft, decisions, new Date().toISOString());
    savePublishedGradingPackage(localStorage, published);
    setPublishedPackage(published);
    setLocalBasePlan(null); setReviewDraft(null); setSanitaryDraft(null); setStormDraft(null); setWaterDraft(null); setWaterStudioOpen(false);
    setPublishedNotice(`Version ${published.packageVersion} · ${published.objects.filter((object) => object.layerId === 'water').length} approved water gates · offline ready`);
    setSelectedObjectId('');
  }, [publishedPackage, waterDraft]);

  const publishDryUtility = useCallback((decisions: DryUtilityReviewDecision[]) => {
    if (!dryUtilityDraft || publishedPackage?.packageVersion !== 'reading-public-library-grading-sanitary-storm-water-v4') return;
    const published = publishApprovedDryUtilityPackage(publishedPackage as import('../lib/waterPipeline').PublishedWaterPackage, dryUtilityDraft, decisions, new Date().toISOString());
    savePublishedGradingPackage(localStorage, published); setPublishedPackage(published); setLocalBasePlan(null); setReviewDraft(null); setSanitaryDraft(null); setStormDraft(null); setWaterDraft(null); setDryUtilityDraft(null); setDryUtilityStudioOpen(false); setPublishedNotice(`Version ${published.packageVersion} · 2 approved light bollards · offline ready`); setSelectedObjectId('');
  }, [dryUtilityDraft, publishedPackage]);

  // Filter objects by search query (ID or label)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return displayPackage.objects
      .filter((o) =>
        o.id.toLowerCase().includes(q) ||
        o.label.toLowerCase().includes(q) ||
        (o.workerLabel ?? '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [searchQuery, displayPackage.objects]);

  const [activePhaseId, setActivePhaseId] = useState(
    () => displayPackage.phases[0]?.id ?? OVERVIEW_PHASE_ID,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivePhaseId(displayPackage.phases[0]?.id ?? OVERVIEW_PHASE_ID);
  }, [displayPackage]);

  const availableLayers = useMemo(() => layersAvailableForPhase(
    displayPackage.layers,
    [...displayPackage.objects, ...displayPackage.utilities],
    activePhaseId,
  ), [activePhaseId, displayPackage.layers, displayPackage.objects, displayPackage.utilities]);

  const isPhaseVisible = useCallback(
    (phase?: string) => {
      if (activePhaseId === OVERVIEW_PHASE_ID) return true;
      if (!phase) return true;
      return phase === activePhaseId;
    },
    [activePhaseId],
  );

  const gps = useGps();

  const [calibrationPoints, setCalibrationPoints] = useState<ControlPoint[]>(
    () => getCalibrationPoints(),
  );

  const calibrationTransform = useMemo(
    () => buildCalibration(calibrationPoints),
    [calibrationPoints],
  );

  const isCalibrated = calibrationTransform !== null;

  const displayLocation = useMemo(() => {
    if (calibrationTransform && gps.lat !== null && gps.lng !== null) {
      const pt = calibrationTransform({ lat: gps.lat, lng: gps.lng });
      return {
        x: Math.max(0, Math.min(displayPackage.plan.widthFt, pt.x)),
        y: Math.max(0, Math.min(displayPackage.plan.heightFt, pt.y)),
      };
    }
    return displayPackage.userLocation;
  }, [calibrationTransform, gps.lat, gps.lng, displayPackage]);

  const displayHeading = gps.heading ?? displayPackage.userHeading;

  const selectedObject = useMemo(
    () => displayPackage.objects.find((o) => o.id === selectedObjectId) ?? null,
    [displayPackage.objects, selectedObjectId],
  );

  const phaseProgress = useMemo(() => {
    const relevant =
      activePhaseId === OVERVIEW_PHASE_ID
        ? displayPackage.objects
        : displayPackage.objects.filter((o) => o.phase === activePhaseId);
    const completed = relevant.filter((o) => getStatus(o.id) === 'done').length;
    return { completed, total: relevant.length };
  }, [displayPackage.objects, activePhaseId, getStatus]);

  const distanceFt = selectedObject ? distanceFeet(displayLocation, selectedObject) : null;
  const bearing = selectedObject ? bearingLabel(displayLocation, selectedObject) : null;

  const handleAddCalibrationPoint = useCallback((point: ControlPoint) => {
    setCalibrationPoints((prev) => {
      const updated = [...prev, point];
      saveCalibrationPoints(updated);
      return updated;
    });
  }, []);

  const handleClearCalibration = useCallback(() => {
    setCalibrationPoints([]);
    saveCalibrationPoints([]);
  }, []);

  const calibrationSummary = displayPackage.planCalibration;

  return (
    <div className="field-app">

      {/* ── Map fills the entire screen ── */}
      <div className="field-app__map">
        <PlanCanvas
          jobsite={displayPackage}
          userLocation={displayLocation}
          userHeading={displayHeading}
          isLayerVisible={isVisible}
          isPhaseVisible={isPhaseVisible}
          getObjectStatus={getStatus}
          selectedObjectId={selectedObjectId}
          onSelectObject={(id) => {
            setSelectedObjectId(id);
            setDrawerOpen(false);
          }}
          recenterToken={recenterToken}
          fitRequestToken={fitPlanToken}
          importedBasePlan={importedBasePlan}
          showSemanticOverlaysWithBasePlan={Boolean(importedSemanticPackage || publishedPackage)}
        />
      </div>

      {/* ── Top overlay bar ── */}
      <header className="field-topbar">
        <button
          className="field-topbar__menu"
          onClick={() => setDrawerOpen((o) => !o)}
          aria-label="Menu"
        >
          <Layers size={20} />
        </button>
        <span className="field-topbar__title">
          <strong>{importedBasePlan ? `${displayPackage.projectName} · ${importedBasePlan.name}` : displayPackage.projectName}</strong>
          {(semanticPublications.activePublication || importedSemanticPackage || publishedPackage) && (
            <small>Model loaded: {displayPackage.projectName}</small>
          )}
        </span>
        {(semanticPublications.activePublication || importedSemanticPackage || publishedPackage || importedBasePlan) && (
          <button
            className="field-topbar__fit"
            type="button"
            onClick={() => setFitPlanToken((token) => token + 1)}
            aria-label="Fit full plan"
          >
            <Expand size={16} />
            <span>Fit full plan</span>
          </button>
        )}
        <button
          className="field-topbar__search"
          onClick={() => {
            setSearchOpen(true);
            setTimeout(() => searchInputRef.current?.focus(), 80);
          }}
          aria-label="Search objects"
        >
          <Search size={18} />
        </button>
        <button
          className="field-topbar__locate"
          onClick={() => setRecenterToken((t) => t + 1)}
          aria-label="Re-center on my location"
        >
          <Navigation size={20} />
        </button>
      </header>

      {publishedNotice && (
        <div className="published-package-status" role="status">
          <strong>{publishedNotice}</strong>
          {calibrationSummary && (
            <>
              <span className="published-package-status__calibration">
                Plan calibration verified · {calibrationSummary.passedCheckCount}/{calibrationSummary.checkCount} checks
              </span>
              <span>Reference-scale product QA · not survey or staking control</span>
            </>
          )}
          <span>Source PDF excluded from offline package</span>
        </div>
      )}
      {!publishedNotice && displayPackage.disclaimer && (
        <div className="published-package-status" role="status">
          <strong>{displayPackage.disclaimer}</strong>
          {calibrationSummary && (
            <>
              <span className="published-package-status__calibration">
                Plan calibration verified · {calibrationSummary.passedCheckCount}/{calibrationSummary.checkCount} checks
              </span>
              <span>Reference-scale product QA · not survey or staking control</span>
            </>
          )}
          <span>Immutable semantic package · verify field conditions and survey control</span>
        </div>
      )}
      {reviewDraft && !publishedPackage && !modelStudioOpen && (
        <button type="button" className="model-studio-launch" onClick={() => setModelStudioOpen(true)}>
          Open Model Studio
        </button>
      )}
      {sanitaryDraft && publishedPackage?.packageVersion === 'reading-public-library-l2.1-grading-v1' && !sanitaryStudioOpen && (
        <button type="button" className="model-studio-launch model-studio-launch--sanitary" onClick={() => setSanitaryStudioOpen(true)}>
          Open Sanitary Studio
        </button>
      )}
      {stormDraft && publishedPackage?.packageVersion === 'reading-public-library-grading-sanitary-v2' && !stormStudioOpen && (
        <button type="button" className="model-studio-launch model-studio-launch--storm" onClick={() => setStormStudioOpen(true)}>Open Storm Studio</button>
      )}
      {waterDraft && publishedPackage?.packageVersion === 'reading-public-library-grading-sanitary-storm-v3' && !waterStudioOpen && (
        <button type="button" className="model-studio-launch model-studio-launch--water" onClick={() => setWaterStudioOpen(true)}>Open Water Studio</button>
      )}
      {dryUtilityDraft && publishedPackage?.packageVersion === 'reading-public-library-grading-sanitary-storm-water-v4' && !dryUtilityStudioOpen && <button type="button" className="model-studio-launch model-studio-launch--dry" onClick={() => setDryUtilityStudioOpen(true)}>Open Dry Utility Studio</button>}

      {/* ── Search overlay ── */}
      {searchOpen && (
        <div className="search-overlay">
          <div className="search-overlay__bar">
            <Search size={16} className="search-overlay__icon" />
            <input
              ref={searchInputRef}
              className="search-overlay__input"
              placeholder="Search by ID or name… (e.g. SAN-MH-3, CB-1)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
                if (e.key === 'Enter' && searchResults[0]) {
                  setSelectedObjectId(searchResults[0].id);
                  setSearchOpen(false);
                  setSearchQuery('');
                }
              }}
            />
            <button
              className="search-overlay__close"
              onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </div>
          {searchResults.length > 0 && (
            <ul className="search-results">
              {searchResults.map((obj) => {
                const layer = displayPackage.layers.find((l) => l.id === obj.layerId);
                return (
                  <li key={obj.id}>
                    <button
                      className="search-result"
                      onClick={() => {
                        setSelectedObjectId(obj.id);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      type="button"
                    >
                      <span
                        className="search-result__dot"
                        style={{ backgroundColor: layer?.color ?? '#888' }}
                      />
                      <span className="search-result__id">{obj.id}</span>
                      <span className="search-result__label">{obj.label.replace(`${obj.id} — `, '')}</span>
                      {obj.blueprintSheet && (
                        <span className="search-result__sheet">Sheet {obj.blueprintSheet}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {searchQuery.trim() && searchResults.length === 0 && (
            <p className="search-no-results">No objects match "{searchQuery}"</p>
          )}
        </div>
      )}

      {/* ── GPS accuracy dot ── */}
      <div className={`field-gps-dot ${gps.active ? (isCalibrated ? 'calibrated' : 'active') : 'inactive'}`} title={isCalibrated ? 'GPS calibrated' : gps.active ? 'GPS active' : 'No GPS'} />

      {/* ── Drawer backdrop + drawer (only rendered when open) ── */}
      {drawerOpen && (
        <div className="field-backdrop" onClick={() => setDrawerOpen(false)} />
      )}

      {drawerOpen && (
      <aside className="field-drawer open">
        <div className="field-drawer__header">
          <span>Layers &amp; Tools</span>
          <button className="icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="field-drawer__body">
          <ProjectManager auth={auth} projects={projects} semanticPublications={semanticPublications} />
          <LeftSidebar
            phases={displayPackage.phases}
            activePhaseId={activePhaseId}
            onSelectPhase={(id) => { setActivePhaseId(id); setDrawerOpen(false); }}
            phaseProgress={phaseProgress}
            layers={availableLayers}
            visibility={visibility}
            onToggleLayer={toggleLayer}
            onDownload={downloadPlans}
            downloading={downloading}
            offlineReady={offlineReady || Boolean(semanticPublications.activePublication)}
            onMyLocation={() => { setRecenterToken((t) => t + 1); setDrawerOpen(false); }}
            onQuickCalculator={() => calcRef.current?.scrollIntoView({ behavior: 'smooth' })}
            distanceFt={distanceFt}
            bearing={bearing}
            isSignedIn={Boolean(auth.user)}
            hasActiveProject={Boolean(projects.activeProject)}
            onUploadPlan={() => setShowSidebarUpload(true)}
            onImportCivilPlan={() => civilPlanInputRef.current?.click()}
            onImportModelPackage={() => modelPackageInputRef.current?.click()}
            importedPlanName={importedBasePlan?.name}
            onOpenModelStudio={reviewDraft ? () => { setModelStudioOpen(true); setDrawerOpen(false); } : undefined}
          />
          <RockCalculator sectionRef={calcRef} />
          <ForemanNotes />
        </div>
      </aside>
      )}

      {/* ── Bottom sheet — slides up when a feature is tapped ── */}
      <div className={`field-sheet${selectedObject ? ' open' : ''}`}>
        <div className="field-sheet__handle" onClick={() => setSelectedObjectId('')} />
        <div className="field-sheet__body">
          <ObjectDetailsPanel
            object={selectedObject}
            distanceFt={distanceFt}
            status={selectedObject ? getStatus(selectedObject.id) : 'not_started'}
            onSetStatus={setStatus}
            calibrationPoints={calibrationPoints}
            gps={gps}
            onAddCalibrationPoint={handleAddCalibrationPoint}
            onClearCalibration={handleClearCalibration}
          />
        </div>
      </div>

      {showSidebarUpload && projects.activeProject && (
        <PlanUploadPanel
          projectId={projects.activeProject.id}
          existingSheetCount={projects.sheets.length}
          onUploaded={(sheet) => {
            projects.reload();
            projects.selectSheet(sheet);
          }}
          onClose={() => setShowSidebarUpload(false)}
        />
      )}
      <input
        ref={civilPlanInputRef}
        className="sr-only"
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Choose a civil plan PDF"
        onChange={(event) => {
          importCivilPlan(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={modelPackageInputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        aria-label="Choose a semantic model package"
        onChange={(event) => {
          importModelPackage(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      {modelStudioOpen && reviewDraft && (
        <ModelStudio draft={reviewDraft} onClose={() => setModelStudioOpen(false)} onPublish={publishGrading} />
      )}
      {sanitaryStudioOpen && sanitaryDraft && (
        <SanitaryStudio draft={sanitaryDraft} onClose={() => setSanitaryStudioOpen(false)} onPublish={publishSanitary} />
      )}
      {stormStudioOpen && stormDraft && (
        <StormStudio draft={stormDraft} onClose={() => setStormStudioOpen(false)} onPublish={publishStorm} />
      )}
      {waterStudioOpen && waterDraft && (
        <WaterStudio draft={waterDraft} onClose={() => setWaterStudioOpen(false)} onPublish={publishWater} />
      )}
      {dryUtilityStudioOpen && dryUtilityDraft && <DryUtilityStudio draft={dryUtilityDraft} onClose={() => setDryUtilityStudioOpen(false)} onPublish={publishDryUtility} />}
    </div>
  );
}
