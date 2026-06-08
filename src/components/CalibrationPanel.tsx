import { MapPin, Trash2 } from 'lucide-react';
import type { GpsState } from '../hooks/useGps';
import type { BlueprintObject, ControlPoint } from '../types/jobsite';

type CalibrationPanelProps = {
  calibrationPoints: ControlPoint[];
  selectedObject: BlueprintObject | null;
  gps: GpsState;
  onAddPoint: (point: ControlPoint) => void;
  onClearPoints: () => void;
};

export function CalibrationPanel({
  calibrationPoints,
  selectedObject,
  gps,
  onAddPoint,
  onClearPoints,
}: CalibrationPanelProps) {
  const count = calibrationPoints.length;
  const isCalibrated = count >= 2;
  const canAdd = selectedObject !== null && gps.lat !== null && count < 4;

  const handleAdd = () => {
    if (!selectedObject || gps.lat === null || gps.lng === null) return;
    onAddPoint({
      id: crypto.randomUUID(),
      label: selectedObject.label,
      planPoint: { x: selectedObject.x, y: selectedObject.y },
      gpsCoord: { lat: gps.lat, lng: gps.lng },
    });
  };

  return (
    <section className="calibration-panel">
      <div className="calibration-panel__header">
        <h3>Plan Calibration</h3>
        {count > 0 && (
          <button
            type="button"
            className="icon-btn"
            onClick={onClearPoints}
            aria-label="Clear all calibration points"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <p className={`calibration-panel__status${isCalibrated ? ' calibration-panel__status--active' : ''}`}>
        {isCalibrated
          ? `Calibration active — ${count} control point${count !== 1 ? 's' : ''}`
          : `${count}/2 control points set`}
      </p>

      {calibrationPoints.length > 0 && (
        <ul className="calibration-points-list">
          {calibrationPoints.map((pt, i) => (
            <li key={pt.id}>
              <MapPin size={11} />
              CP-{i + 1}: {pt.label}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className={`btn btn--sm${canAdd ? ' btn--secondary' : ' btn--disabled'}`}
        disabled={!canAdd}
        onClick={handleAdd}
        title={
          !gps.active
            ? 'GPS not active — enable location permissions'
            : !selectedObject
              ? 'Select an object on the plan first'
              : count >= 4
                ? 'Maximum 4 calibration points'
                : 'Stand on this point in the field and tap to set'
        }
      >
        <MapPin size={13} />
        Set Control Point ({count}/2)
      </button>

      {!gps.available && (
        <p className="calibration-panel__note">GPS not available on this device.</p>
      )}
      {gps.available && !gps.active && !gps.error && (
        <p className="calibration-panel__note">Acquiring GPS signal…</p>
      )}
      {gps.error && (
        <p className="calibration-panel__note calibration-panel__note--error">{gps.error}</p>
      )}

      <p className="calibration-panel__instructions">
        {isCalibrated
          ? 'Your position is mapped to this plan via GPS calibration. Location accuracy shown in the status bar.'
          : 'Stand on a known object shown on the plan, select it, then tap Set Control Point. Repeat for a second object to activate GPS tracking.'}
      </p>
    </section>
  );
}
