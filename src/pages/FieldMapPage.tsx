import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultSelectedObjectId } from '../data/sampleJobsite';
import { ForemanNotes } from '../components/ForemanNotes';
import { GpsWarningBanner } from '../components/GpsWarningBanner';
import { LeftSidebar } from '../components/LeftSidebar';
import { ObjectDetailsPanel } from '../components/ObjectDetailsPanel';
import { PlanCanvas } from '../components/PlanCanvas';
import { ProjectManager } from '../components/ProjectManager';
import { RockCalculator } from '../components/RockCalculator';
import { StatusBar } from '../components/StatusBar';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../hooks/useAuth';
import { useGps } from '../hooks/useGps';
import { useJobsitePackage } from '../hooks/useJobsitePackage';
import { useLayerVisibility } from '../hooks/useLayerVisibility';
import { useObjectStatus } from '../hooks/useObjectStatus';
import { useProjects } from '../hooks/useProjects';
import { OVERVIEW_PHASE_ID, type ControlPoint } from '../types/jobsite';
import { buildCalibration } from '../utils/calibration';
import { bearingLabel, distanceFeet } from '../utils/distance';
import { getCalibrationPoints, saveCalibrationPoints } from '../utils/storage';

export function FieldMapPage() {
  const auth = useAuth();
  const projects = useProjects();
  const { offlineReady, downloading, downloadPlans, activePackage } = useJobsitePackage();

  // When a Supabase project is active, use its name; also swap the plan image if an uploaded sheet is selected
  const displayPackage = useMemo(() => {
    if (projects.activeProject) {
      return {
        ...activePackage,
        projectName: projects.activeProject.name,
        plan: projects.activeSheet?.public_url
          ? { ...activePackage.plan, imageUrl: projects.activeSheet.public_url }
          : activePackage.plan,
      };
    }
    return activePackage;
  }, [activePackage, projects.activeProject, projects.activeSheet]);
  const { visibility, toggleLayer, isVisible } = useLayerVisibility(displayPackage.layers);
  const { setStatus, getStatus } = useObjectStatus();
  const [selectedObjectId, setSelectedObjectId] = useState(defaultSelectedObjectId);
  const [recenterToken, setRecenterToken] = useState(0);
  const calculatorRef = useRef<HTMLElement>(null);

  const [activePhaseId, setActivePhaseId] = useState(
    () => displayPackage.phases[0]?.id ?? OVERVIEW_PHASE_ID,
  );

  // Reset to the first phase if the active package changes (e.g. plans re-downloaded)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivePhaseId(displayPackage.phases[0]?.id ?? OVERVIEW_PHASE_ID);
  }, [displayPackage]);

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

  const handleMyLocation = () => setRecenterToken((t) => t + 1);

  const handleQuickCalculator = () => {
    calculatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="app-shell">
      <TopBar projectName={displayPackage.projectName} offlineReady={offlineReady} />
      <GpsWarningBanner />
      <ProjectManager auth={auth} projects={projects} />

      <div className="main-layout">
        <LeftSidebar
          phases={displayPackage.phases}
          activePhaseId={activePhaseId}
          onSelectPhase={setActivePhaseId}
          phaseProgress={phaseProgress}
          layers={displayPackage.layers}
          visibility={visibility}
          onToggleLayer={toggleLayer}
          onDownload={downloadPlans}
          downloading={downloading}
          offlineReady={offlineReady}
          onMyLocation={handleMyLocation}
          onQuickCalculator={handleQuickCalculator}
          distanceFt={distanceFt}
          bearing={bearing}
        />

        <main className="map-area">
          <PlanCanvas
            jobsite={displayPackage}
            userLocation={displayLocation}
            userHeading={displayHeading}
            isLayerVisible={isVisible}
            isPhaseVisible={isPhaseVisible}
            getObjectStatus={getStatus}
            selectedObjectId={selectedObjectId}
            onSelectObject={setSelectedObjectId}
            recenterToken={recenterToken}
          />
        </main>

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

      <div className="bottom-panels">
        <RockCalculator sectionRef={calculatorRef} />
        <ForemanNotes />
      </div>

      <StatusBar
        gpsAccuracyM={gps.accuracyM}
        gpsActive={gps.active}
        calibrated={isCalibrated}
      />
    </div>
  );
}
