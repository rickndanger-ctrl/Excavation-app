import { Lightbulb } from 'lucide-react';
import type { GpsState } from '../hooks/useGps';
import type { BlueprintObject, ControlPoint, ObjectStatus } from '../types/jobsite';
import { formatFeet } from '../utils/distance';
import { CalibrationPanel } from './CalibrationPanel';

const STATUS_OPTIONS: { value: ObjectStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

function typeLabel(type: BlueprintObject['type']): string {
  const labels: Record<BlueprintObject['type'], string> = {
    manhole: 'Manhole',
    catch_basin: 'Catch Basin',
    curb: 'Curb Point',
    building_pad: 'Building Pad',
    elevation: 'Elevation Callout',
    property_corner: 'Property Corner',
    slope_marker: 'Slope Marker',
    fdc: 'FDC Connection',
    vault: 'Utility Vault',
  };
  return labels[type] ?? type;
}

type ObjectDetailsPanelProps = {
  object: BlueprintObject | null;
  distanceFt: number | null;
  status: ObjectStatus;
  onSetStatus: (objectId: string, status: ObjectStatus) => void;
  calibrationPoints: ControlPoint[];
  gps: GpsState;
  onAddCalibrationPoint: (point: ControlPoint) => void;
  onClearCalibration: () => void;
};

export function ObjectDetailsPanel({
  object,
  distanceFt,
  status,
  onSetStatus,
  calibrationPoints,
  gps,
  onAddCalibrationPoint,
  onClearCalibration,
}: ObjectDetailsPanelProps) {
  return (
    <aside className="right-sidebar">
      {object ? (
        <>
          <section className="object-details">
            <div className="object-details__header">
              <h2 className="object-details__name">{object.label}</h2>
              <span className="object-details__type">{typeLabel(object.type)}</span>
            </div>

            <div className="status-control">
              <span className="status-control__label">Field Status</span>
              <div className="status-control__buttons" role="group" aria-label="Field status">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`status-btn status-btn--${opt.value}${
                      status === opt.value ? ' status-btn--active' : ''
                    }`}
                    aria-pressed={status === opt.value}
                    onClick={() => onSetStatus(object.id, opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <dl className="detail-list">
              {object.phase && (
                <div className="detail-row">
                  <dt>Phase</dt>
                  <dd>{object.phase}</dd>
                </div>
              )}
              {object.elevation && (
                <div className="detail-row">
                  <dt>Elevation</dt>
                  <dd>{object.elevation} ft</dd>
                </div>
              )}
              {object.depth && (
                <div className="detail-row">
                  <dt>Depth</dt>
                  <dd>{object.depth}</dd>
                </div>
              )}
              {object.slope && (
                <div className="detail-row">
                  <dt>Slope</dt>
                  <dd>{object.slope}</dd>
                </div>
              )}
              {distanceFt !== null && (
                <div className="detail-row detail-row--highlight">
                  <dt>Distance</dt>
                  <dd>{formatFeet(distanceFt)}</dd>
                </div>
              )}
              {object.nearbyRef && (
                <div className="detail-row">
                  <dt>Nearby Ref</dt>
                  <dd>{object.nearbyRef}</dd>
                </div>
              )}
              {object.blueprintSheet && (
                <div className="detail-row">
                  <dt>Blueprint</dt>
                  <dd>{object.blueprintSheet}</dd>
                </div>
              )}
              {object.notes && (
                <div className="detail-row">
                  <dt>Notes</dt>
                  <dd>{object.notes}</dd>
                </div>
              )}
            </dl>
          </section>

          <div className="field-tip">
            <Lightbulb size={16} className="field-tip__icon" />
            <p>
              Confirm this point with survey stakes, control points, curb offsets,
              or building corners before layout.
            </p>
          </div>
        </>
      ) : (
        <p className="empty-state">Select an object on the plan to view details.</p>
      )}

      <CalibrationPanel
        calibrationPoints={calibrationPoints}
        selectedObject={object}
        gps={gps}
        onAddPoint={onAddCalibrationPoint}
        onClearPoints={onClearCalibration}
      />
    </aside>
  );
}
