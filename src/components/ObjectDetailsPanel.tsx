import { AlertTriangle, BookOpen, CheckSquare, ClipboardList, Lightbulb, MapPin, Wrench } from 'lucide-react';
import { useState } from 'react';
import { getDetailCards } from '../data/standardDetails';
import type { GpsState } from '../hooks/useGps';
import type {
  BlueprintObject,
  ChecklistItem,
  ControlPoint,
  ObjectStatus,
  SafetyFlag,
  VerticalDesignBasis,
} from '../types/jobsite';
import { formatFeet } from '../utils/distance';
import { CalibrationPanel } from './CalibrationPanel';

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabId = 'summary' | 'specs' | 'safety' | 'details' | 'workflow' | 'checklist';

const ALL_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'summary',   label: 'Summary',  icon: <MapPin size={13} /> },
  { id: 'specs',     label: 'Specs',    icon: <Wrench size={13} /> },
  { id: 'safety',    label: 'Safety',   icon: <AlertTriangle size={13} /> },
  { id: 'details',   label: 'Details',  icon: <BookOpen size={13} /> },
  { id: 'workflow',  label: 'Workflow', icon: <ClipboardList size={13} /> },
  { id: 'checklist', label: 'Checklist',icon: <CheckSquare size={13} /> },
];

const MAPPED_VERTICAL_DETAIL_KEYS = new Set([
  'building_subgrade_elevation_ft',
  'curb_reveal_ft',
  'centerline_elevation_samples_ft',
  'cover_reference',
  'exterior_landing_elevation_ft',
  'finished_floor_elevation_ft',
  'finished_grade_elevation_ft',
  'finished_grade_ft',
  'finished_grade_range_ft',
  'grade_controls',
  'gutter_elevation_ft',
  'incoming_invert_navd88_ft',
  'invert_elevation_ft',
  'invert_ft',
  'invert_in_ft',
  'invert_out_ft',
  'model_vertical_datum',
  'non_entry_perimeter_grade_range_ft',
  'outgoing_invert_navd88_ft',
  'rim_elevation_ft',
  'rim_elevation_navd88_ft',
  'subgrade_elevation_ft',
  'surface_samples_ft',
  'threshold_elevation_ft',
  'top_of_curb_elevation_ft',
  'utility_top_elevation_samples_ft',
  'upstream_invert_ft',
  'downstream_invert_ft',
  'vertical_callout',
  'vertical_datum',
  'vertical_profile',
  'vertical_status',
]);

function feet(value: string): string {
  const trimmed = value.trim();
  return /^-?\d+(?:\.\d+)?(?:\s*(?:-|→)\s*-?\d+(?:\.\d+)?)?$/.test(trimmed)
    ? `${trimmed} ft`
    : trimmed;
}

// ── Type labels ───────────────────────────────────────────────────────────────

function typeLabel(type: BlueprintObject['type']): string {
  const labels: Record<string, string> = {
    manhole: 'Manhole',
    catch_basin: 'Catch Basin',
    curb: 'Curb Section',
    curb_line: 'Curb Line',
    sidewalk: 'Sidewalk',
    grade_break: 'Grade Break',
    parking_lot: 'Parking / Pavement Zone',
    building_pad: 'Building Pad',
    elevation: 'Elevation Callout',
    property_corner: 'Property Corner',
    slope_marker: 'Slope Marker',
    fdc: 'FDC Connection',
    vault: 'Utility Vault',
    drywell: 'Drywell / Infiltration',
    cleanout: 'Cleanout',
    hydrant: 'Fire Hydrant',
    gate_valve: 'Gate Valve / Tap',
    meter: 'Meter / Vault',
    fire_service: 'Fire Service',
    light_pole: 'Light Pole Base',
    stockpile: 'Stockpile Zone',
    control_point: 'Control Point',
    ada_ramp: 'ADA Ramp',
    construction_entrance: 'Construction Entrance',
    sanitary_pipe: 'Sanitary Pipe',
  };
  return labels[type] ?? type;
}

// ── Safety config ─────────────────────────────────────────────────────────────

const SAFETY_CONFIG: Record<NonNullable<SafetyFlag>, { label: string; className: string } | null> = {
  none: null,
  egress_4ft_plus: {
    label: 'EGRESS REQUIRED — Ladder or ramp within 25 ft (4+ ft depth)',
    className: 'safety-flag safety-flag--egress',
  },
  deep_5ft_plus: {
    label: 'DEEP TRENCH — Cave-in protection required (5+ ft depth)',
    className: 'safety-flag safety-flag--deep',
  },
  utility_conflict: {
    label: 'UTILITY CONFLICT — Verify locates before excavation',
    className: 'safety-flag safety-flag--utility',
  },
};

// ── Foreman strip ─────────────────────────────────────────────────────────────

function ForemanStrip({ object, distanceFt }: { object: BlueprintObject; distanceFt: number | null }) {
  const keyElev = object.rimElevation
    ?? object.finishedFloorElevation
    ?? object.thresholdElevation
    ?? object.topElevation
    ?? object.finishedGrade
    ?? object.pipeCenterlineElevation
    ?? object.utilityTopElevation
    ?? object.elevation
    ?? null;
  const warning = object.warnings?.[0] ?? null;
  return (
    <div className="foreman-strip">
      <div className="foreman-strip__row">
        <span className="foreman-strip__id">{object.id}</span>
        <span className="foreman-strip__type">{typeLabel(object.type)}</span>
        {object.blueprintSheet && (
          <span className="foreman-strip__sheet">Sheet {object.blueprintSheet}</span>
        )}
      </div>
      <div className="foreman-strip__metrics">
        {keyElev && (
          <div className="foreman-strip__metric">
            <span className="foreman-strip__metric-label">Key Elev.</span>
            <span className="foreman-strip__metric-val">{feet(keyElev)}</span>
          </div>
        )}
        {object.depth && (
          <div className="foreman-strip__metric">
            <span className="foreman-strip__metric-label">Depth</span>
            <span className="foreman-strip__metric-val">{object.depth}</span>
          </div>
        )}
        {distanceFt !== null && (
          <div className="foreman-strip__metric">
            <span className="foreman-strip__metric-label">Distance</span>
            <span className="foreman-strip__metric-val">{formatFeet(distanceFt)}</span>
          </div>
        )}
        {object.phase && (
          <div className="foreman-strip__metric">
            <span className="foreman-strip__metric-label">Phase</span>
            <span className="foreman-strip__metric-val">{object.phase.replace('phase-', 'Ph ')}</span>
          </div>
        )}
      </div>
      {warning && (
        <div className="foreman-strip__warning">
          <AlertTriangle size={12} />
          <span>{warning}</span>
        </div>
      )}
    </div>
  );
}

// ── Tab: Summary ──────────────────────────────────────────────────────────────

function SummaryTab({
  object,
  distanceFt,
  verticalDesignBasis,
}: {
  object: BlueprintObject;
  distanceFt: number | null;
  verticalDesignBasis?: VerticalDesignBasis;
}) {
  const rawMeasurementTips = object.fieldDetail?.measurement_tips;
  const measurementTips = Array.isArray(rawMeasurementTips)
    ? rawMeasurementTips.filter((value): value is { id?: string; label: string; distance_ft: number } => (
      Boolean(value)
      && typeof value === 'object'
      && typeof (value as Record<string, unknown>).label === 'string'
      && Number.isFinite((value as Record<string, unknown>).distance_ft)
    ))
    : [];
  const semanticDetails = Object.entries(object.fieldDetail ?? {})
    .filter(([key]) => key !== 'measurement_tips' && !MAPPED_VERTICAL_DETAIL_KEYS.has(key));
  return (
    <div className="tab-content">
      {measurementTips.length > 0 && (
        <div className="detail-section measurement-tips">
          <div className="detail-section__title">Measurement &amp; Location Tips</div>
          <ul className="info-list">
            {measurementTips.map((tip, index) => (
              <li key={tip.id ?? `${object.id}-measurement-tip-${index}`}>
                <strong>{tip.distance_ft.toFixed(1)} FT</strong> · {tip.label}
              </li>
            ))}
          </ul>
          <p className="measurement-tips__basis">Plan-derived guidance · verify control before field use</p>
        </div>
      )}

      {object.verticalCallout && (
        <div className="vertical-callout" aria-label="Vertical Callout">
          <span>Vertical Callout</span>
          <strong>{object.verticalCallout}</strong>
        </div>
      )}

      {/* Location / layout */}
      {(object.nearbyRef || object.locationGuidance) && (
        <div className="detail-section">
          <div className="detail-section__title">Location / Layout</div>
          {object.nearbyRef && (
            <div className="detail-row">
              <dt>Reference</dt>
              <dd>{object.nearbyRef}</dd>
            </div>
          )}
          {object.locationGuidance && (
            <div className="detail-row detail-row--guidance">
              <dt>How to find it</dt>
              <dd>{object.locationGuidance}</dd>
            </div>
          )}
          {distanceFt !== null && (
            <div className="detail-row detail-row--highlight">
              <dt>Distance from you</dt>
              <dd>{formatFeet(distanceFt)}</dd>
            </div>
          )}
        </div>
      )}

      {/* Elevations */}
      <div className="detail-section">
        <div className="detail-section__title">Elevations</div>
        <dl className="detail-list">
          {object.finishedFloorElevation && (
            <div className="detail-row detail-row--highlight">
              <dt>Finished Floor</dt>
              <dd>{feet(object.finishedFloorElevation)}</dd>
            </div>
          )}
          {object.rimElevation && (
            <div className="detail-row detail-row--highlight">
              <dt>Rim / Grate</dt>
              <dd>{feet(object.rimElevation)}</dd>
            </div>
          )}
          {object.invertIn && (
            <div className="detail-row detail-row--highlight">
              <dt>Invert In</dt>
              <dd>{feet(object.invertIn)}</dd>
            </div>
          )}
          {object.invertOut && (
            <div className="detail-row detail-row--highlight">
              <dt>Invert Out</dt>
              <dd>{feet(object.invertOut)}</dd>
            </div>
          )}
          {object.invertElevation && !object.invertIn && !object.invertOut && (
            <div className="detail-row detail-row--highlight">
              <dt>Invert</dt>
              <dd>{feet(object.invertElevation)}</dd>
            </div>
          )}
          {object.thresholdElevation && (
            <div className="detail-row detail-row--highlight">
              <dt>Threshold</dt>
              <dd>{feet(object.thresholdElevation)}</dd>
            </div>
          )}
          {object.landingElevation && (
            <div className="detail-row detail-row--highlight">
              <dt>Exterior Landing</dt>
              <dd>{feet(object.landingElevation)}</dd>
            </div>
          )}
          {object.dropAcross && (
            <div className="detail-row">
              <dt>Drop Across</dt>
              <dd>{object.dropAcross}</dd>
            </div>
          )}
          {object.topElevation && (
            <div className="detail-row detail-row--highlight">
              <dt>{object.type === 'curb' || object.type === 'curb_line' ? 'Top of Curb' : 'Top Elevation'}</dt>
              <dd>{feet(object.topElevation)}</dd>
            </div>
          )}
          {object.gutterElevation && (
            <div className="detail-row detail-row--highlight">
              <dt>Gutter</dt>
              <dd>{feet(object.gutterElevation)}</dd>
            </div>
          )}
          {object.finishedGrade && (
            <div className="detail-row detail-row--highlight">
              <dt>Finished Grade</dt>
              <dd>{feet(object.finishedGrade)}</dd>
            </div>
          )}
          {object.finishedSurfaceElevation && (
            <div className="detail-row detail-row--highlight">
              <dt>Finished Surface</dt>
              <dd>{feet(object.finishedSurfaceElevation)}</dd>
            </div>
          )}
          {object.pipeCenterlineElevation && (
            <div className="detail-row detail-row--highlight">
              <dt>Pipe Centerline</dt>
              <dd>{feet(object.pipeCenterlineElevation)}</dd>
            </div>
          )}
          {object.utilityTopElevation && (
            <div className="detail-row detail-row--highlight">
              <dt>Utility Top</dt>
              <dd>{feet(object.utilityTopElevation)}</dd>
            </div>
          )}
          {object.coverBasis && (
            <div className="detail-row">
              <dt>Cover Basis</dt>
              <dd>{object.coverBasis}</dd>
            </div>
          )}
          {object.elevation && !object.rimElevation && !object.topElevation && (
            <div className="detail-row">
              <dt>Elevation</dt>
              <dd>{object.elevation}</dd>
            </div>
          )}
          {object.pipeSlope && (
            <div className="detail-row">
              <dt>Pipe Slope</dt>
              <dd>{object.pipeSlope}</dd>
            </div>
          )}
          {object.slope && (
            <div className="detail-row">
              <dt>Slope / Grade</dt>
              <dd>{object.slope}</dd>
            </div>
          )}
          {object.depth && (
            <div className="detail-row">
              <dt>Depth</dt>
              <dd>{object.depth}</dd>
            </div>
          )}
          {object.length && (
            <div className="detail-row">
              <dt>Length to Next</dt>
              <dd>{object.length}</dd>
            </div>
          )}
          {object.curbReveal && (
            <div className="detail-row detail-row--highlight">
              <dt>Curb Reveal</dt>
              <dd>{object.curbReveal} above asphalt</dd>
            </div>
          )}
          {object.subgradeElev && (
            <div className="detail-row">
              <dt>Subgrade</dt>
              <dd>{feet(object.subgradeElev)}</dd>
            </div>
          )}
          {object.verticalProfile && (
            <>
              <div className="detail-row"><dt>Profile High</dt><dd>{feet(object.verticalProfile.highElevation)}{object.verticalProfile.highLocation ? ` · ${object.verticalProfile.highLocation}` : ''}</dd></div>
              <div className="detail-row"><dt>Profile Low</dt><dd>{feet(object.verticalProfile.lowElevation)}{object.verticalProfile.lowLocation ? ` · ${object.verticalProfile.lowLocation}` : ''}</dd></div>
              <div className="detail-row"><dt>Profile Run</dt><dd>{feet(object.verticalProfile.run)}</dd></div>
              <div className="detail-row"><dt>Profile Slope</dt><dd>{object.verticalProfile.slopePercent}%</dd></div>
            </>
          )}
          {object.verticalDatum && (
            <div className="detail-row"><dt>Vertical Datum</dt><dd>{object.verticalDatum}</dd></div>
          )}
          {object.verticalStatus && (
            <div className="detail-row"><dt>Vertical Status</dt><dd>{object.verticalStatus.replaceAll('_', ' ')}</dd></div>
          )}
        </dl>
      </div>

      {verticalDesignBasis && (
        <div className="detail-section vertical-basis">
          <div className="detail-section__title">Whole-job vertical basis</div>
          <dl className="detail-list">
            <div className="detail-row"><dt>Datum</dt><dd>{verticalDesignBasis.verticalDatum} · {verticalDesignBasis.units}</dd></div>
            <div className="detail-row"><dt>Status</dt><dd>{verticalDesignBasis.status.replaceAll('_', ' ')}</dd></div>
            <div className="detail-row"><dt>Benchmark</dt><dd>Benchmark {verticalDesignBasis.benchmarkStatus}</dd></div>
            <div className="detail-row"><dt>Survey authority</dt><dd>No</dd></div>
            <div className="detail-row"><dt>FFE / pad SG</dt><dd>{verticalDesignBasis.finishedFloorElevationFt.toFixed(2)} / {verticalDesignBasis.buildingSubgradeElevationFt.toFixed(2)} ft</dd></div>
          </dl>
          <p className="vertical-basis__warning">{verticalDesignBasis.warning}</p>
        </div>
      )}

      {object.provenance && (
        <div className="detail-section">
          <div className="detail-section__title">Source &amp; confidence</div>
          <dl className="detail-list">
            <div className="detail-row"><dt>Provenance</dt><dd>{object.provenance.status.charAt(0).toUpperCase() + object.provenance.status.slice(1)}</dd></div>
            {object.confidence && <div className="detail-row"><dt>Confidence</dt><dd>{object.confidence === 'high' ? 'High confidence' : 'Medium confidence'}</dd></div>}
            {(object.provenance.sheet || object.provenance.pdfPage) && <div className="detail-row"><dt>Source</dt><dd>Sheet {object.provenance.sheet}, PDF page {object.provenance.pdfPage}</dd></div>}
            {(object.provenance.sourceIds?.length ?? 0) > 0 && <div className="detail-row"><dt>Source IDs</dt><dd>{object.provenance.sourceIds!.join(', ')}</dd></div>}
            {(object.provenance.decisionIds?.length ?? 0) > 0 && <div className="detail-row"><dt>Decision IDs</dt><dd>{object.provenance.decisionIds!.join(', ')}</dd></div>}
            {object.provenance.sourceText && <div className="detail-row"><dt>Extracted text</dt><dd>{object.provenance.sourceText.join(' / ')}</dd></div>}
          </dl>
        </div>
      )}

      {semanticDetails.length > 0 && (
        <div className="detail-section">
          <div className="detail-section__title">Semantic field data</div>
          <dl className="detail-list">
            {semanticDetails.map(([key, value]) => (
              <div className="detail-row" key={key}>
                <dt>{key.replaceAll('_', ' ')}</dt>
                <dd>{typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Pavement stack (parking lot) */}
      {object.type === 'parking_lot' && object.topElevation && (
        <div className="detail-section">
          <div className="detail-section__title">Surface Stack (top → bottom)</div>
          <div className="pavement-stack">
            <div className="pavement-stack__row pavement-stack__row--asphalt">
              <span className="pavement-stack__label">Finish Asphalt</span>
              <span className="pavement-stack__val">{object.topElevation} ft</span>
            </div>
            {object.concreteThickness && (
              <div className="pavement-stack__row">
                <span className="pavement-stack__label">Asphalt Depth</span>
                <span className="pavement-stack__val">{object.concreteThickness}</span>
              </div>
            )}
            {object.rockThickness && (
              <div className="pavement-stack__row pavement-stack__row--rock">
                <span className="pavement-stack__label">Rock Base</span>
                <span className="pavement-stack__val">{object.rockThickness}</span>
              </div>
            )}
            {object.subgradeElev && (
              <div className="pavement-stack__row pavement-stack__row--sub">
                <span className="pavement-stack__label">Subgrade</span>
                <span className="pavement-stack__val">{object.subgradeElev} ft</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connections */}
      {object.connections && (
        <div className="detail-section">
          <div className="detail-section__title">Connections</div>
          <dl className="detail-list">
            {(object.connections.upstream?.length ?? 0) > 0 && (
              <div className="detail-row">
                <dt>Upstream</dt>
                <dd>{object.connections.upstream!.join(', ')}</dd>
              </div>
            )}
            {(object.connections.downstream?.length ?? 0) > 0 && (
              <div className="detail-row">
                <dt>Downstream</dt>
                <dd>{object.connections.downstream!.join(', ')}</dd>
              </div>
            )}
            {(object.connections.laterals?.length ?? 0) > 0 && (
              <div className="detail-row">
                <dt>Laterals</dt>
                <dd>{object.connections.laterals!.join(', ')}</dd>
              </div>
            )}
            {(object.connections.crossings?.length ?? 0) > 0 && (
              <div className="detail-row detail-row--highlight">
                <dt>Crossings</dt>
                <dd>{object.connections.crossings!.join(', ')}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Notes */}
      {object.notes && (
        <div className="detail-section">
          <div className="detail-section__title">Field Notes</div>
          <p className="detail-note">{object.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Tab: Specs ────────────────────────────────────────────────────────────────

function SpecsTab({ object }: { object: BlueprintObject }) {
  const hasDims = object.dimensions && Object.values(object.dimensions).some(Boolean);
  const hasMats = object.materials && Object.values(object.materials).some(Boolean);
  const hasWalk = object.type === 'sidewalk' || object.type === 'curb';

  if (!hasDims && !hasMats && !hasWalk) {
    return (
      <div className="tab-content tab-content--empty">
        <p>No spec data for this object yet.</p>
        <p className="empty-hint">Specs will be added when plan-set data is linked.</p>
      </div>
    );
  }

  return (
    <div className="tab-content">
      {hasDims && (
        <div className="detail-section">
          <div className="detail-section__title">Dimensions</div>
          <dl className="detail-list">
            {object.dimensions!.structureType && (
              <div className="detail-row detail-row--highlight"><dt>Structure Type</dt><dd>{object.dimensions!.structureType}</dd></div>
            )}
            {object.dimensions!.diameter && (
              <div className="detail-row"><dt>Diameter</dt><dd>{object.dimensions!.diameter}</dd></div>
            )}
            {object.dimensions!.pipeSize && (
              <div className="detail-row"><dt>Pipe Size</dt><dd>{object.dimensions!.pipeSize}</dd></div>
            )}
            {object.dimensions!.width && (
              <div className="detail-row"><dt>Width</dt><dd>{object.dimensions!.width}</dd></div>
            )}
            {object.dimensions!.depth && (
              <div className="detail-row"><dt>Depth</dt><dd>{object.dimensions!.depth}</dd></div>
            )}
            {object.dimensions!.length && (
              <div className="detail-row"><dt>Length</dt><dd>{object.dimensions!.length}</dd></div>
            )}
            {object.dimensions!.wallThickness && (
              <div className="detail-row"><dt>Wall Thickness</dt><dd>{object.dimensions!.wallThickness}</dd></div>
            )}
            {object.dimensions!.sdr && (
              <div className="detail-row"><dt>SDR Rating</dt><dd>{object.dimensions!.sdr}</dd></div>
            )}
          </dl>
        </div>
      )}

      {hasMats && (
        <div className="detail-section">
          <div className="detail-section__title">Materials & Spec</div>
          <dl className="detail-list">
            {object.materials!.primary && (
              <div className="detail-row detail-row--highlight"><dt>Primary Material</dt><dd>{object.materials!.primary}</dd></div>
            )}
            {object.materials!.pipe && (
              <div className="detail-row"><dt>Pipe</dt><dd>{object.materials!.pipe}</dd></div>
            )}
            {object.materials!.fitting && (
              <div className="detail-row"><dt>Fitting / Opening</dt><dd>{object.materials!.fitting}</dd></div>
            )}
            {object.materials!.bedding && (
              <div className="detail-row"><dt>Bedding</dt><dd>{object.materials!.bedding}</dd></div>
            )}
            {object.materials!.backfill && (
              <div className="detail-row"><dt>Backfill</dt><dd>{object.materials!.backfill}</dd></div>
            )}
            {object.materials!.concrete && (
              <div className="detail-row"><dt>Concrete</dt><dd>{object.materials!.concrete}</dd></div>
            )}
            {object.materials!.compaction && (
              <div className="detail-row"><dt>Compaction</dt><dd>{object.materials!.compaction}</dd></div>
            )}
            {object.materials!.geotextile && (
              <div className="detail-row"><dt>Geotextile</dt><dd>{object.materials!.geotextile}</dd></div>
            )}
            {object.materials!.tracer && (
              <div className="detail-row"><dt>Tracer Wire</dt><dd>{object.materials!.tracer}</dd></div>
            )}
          </dl>
        </div>
      )}

      {hasWalk && (
        <div className="detail-section">
          <div className="detail-section__title">Flatwork Spec</div>
          <dl className="detail-list">
            {object.concreteThickness && (
              <div className="detail-row detail-row--highlight"><dt>Thickness</dt><dd>{object.concreteThickness}</dd></div>
            )}
            {object.width && (
              <div className="detail-row"><dt>Width</dt><dd>{object.width}</dd></div>
            )}
            {object.rockThickness && (
              <div className="detail-row"><dt>Rock Base</dt><dd>{object.rockThickness}</dd></div>
            )}
            {object.slope && (
              <div className="detail-row"><dt>Slope / Grade</dt><dd>{object.slope}</dd></div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

// ── Tab: Safety ───────────────────────────────────────────────────────────────

function SafetyTab({ object }: { object: BlueprintObject }) {
  const hasWarnings = (object.warnings?.length ?? 0) > 0;
  const hasSafetyFlag = object.safetyFlag && object.safetyFlag !== 'none';

  if (!hasWarnings && !hasSafetyFlag) {
    return (
      <div className="tab-content tab-content--empty">
        <p>No specific hazards flagged for this object.</p>
        <p className="empty-hint">Always follow site safety plan and OSHA 1926 Subpart P for excavation work.</p>
      </div>
    );
  }

  const safetyConfig = hasSafetyFlag ? SAFETY_CONFIG[object.safetyFlag!] : null;

  return (
    <div className="tab-content">
      {safetyConfig && (
        <div className={`${safetyConfig.className} safety-large`}>
          <AlertTriangle size={18} />
          <span>{safetyConfig.label}</span>
        </div>
      )}

      {hasWarnings && (
        <div className="detail-section">
          <div className="detail-section__title">Hazards & Requirements</div>
          <ul className="warning-list">
            {object.warnings!.map((w, i) => (
              <li key={i} className="warning-item">
                <AlertTriangle size={12} className="warning-item__icon" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="detail-section">
        <div className="detail-section__title">General Excavation Safety</div>
        <ul className="info-list">
          <li>Trench depths &gt; 4 ft: egress (ladder/ramp) within 25 ft</li>
          <li>Trench depths &gt; 5 ft: cave-in protection required (box, shore, or slope)</li>
          <li>Confined space &gt; 4 ft: 4-gas monitor before entry, standby required</li>
          <li>Utilities: Call 811 min 2 business days before dig</li>
          <li>Live traffic near excavation: Type III barricades + flagger if required</li>
          <li>Water in trench: pump to sediment trap, not street</li>
        </ul>
      </div>
    </div>
  );
}

// ── Tab: Standard Details ─────────────────────────────────────────────────────

function DetailsTab({ object }: { object: BlueprintObject }) {
  const refs = object.detailRefs ?? [];
  const cards = getDetailCards(refs);
  const [openId, setOpenId] = useState<string | null>(null);

  if (cards.length === 0) {
    return (
      <div className="tab-content tab-content--empty">
        <p>No standard details linked yet.</p>
        <p className="empty-hint">Links to City standard drawings will be added as plan-set data is imported.</p>
      </div>
    );
  }

  return (
    <div className="tab-content">
      {cards.map((card) => {
        const isOpen = openId === card.id;
        return (
          <div key={card.id} className={`detail-card${isOpen ? ' detail-card--open' : ''}`}>
            <button
              className="detail-card__header"
              onClick={() => setOpenId(isOpen ? null : card.id)}
              type="button"
            >
              <div className="detail-card__title">
                <BookOpen size={13} />
                <span>{card.title}</span>
              </div>
              <div className="detail-card__meta">
                <span className="detail-card__drawing">{card.drawingNumber}</span>
                <span className="detail-card__agency">{card.agency}</span>
                <span className="detail-card__chevron">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {isOpen && (
              <div className="detail-card__body">
                <p className="detail-card__summary">{card.fieldSummary}</p>

                {card.keyDimensions.length > 0 && (
                  <div className="detail-card__section">
                    <div className="detail-card__section-title">Key Dimensions</div>
                    <ul className="info-list">
                      {card.keyDimensions.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  </div>
                )}
                {card.materials.length > 0 && (
                  <div className="detail-card__section">
                    <div className="detail-card__section-title">Materials</div>
                    <ul className="info-list">
                      {card.materials.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}
                {card.warnings.length > 0 && (
                  <div className="detail-card__section">
                    <div className="detail-card__section-title">Warnings</div>
                    <ul className="warning-list">
                      {card.warnings.map((w, i) => (
                        <li key={i} className="warning-item">
                          <AlertTriangle size={11} className="warning-item__icon" />
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {card.commonMistakes.length > 0 && (
                  <div className="detail-card__section">
                    <div className="detail-card__section-title">Common Mistakes</div>
                    <ul className="info-list info-list--mistakes">
                      {card.commonMistakes.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Workflow ─────────────────────────────────────────────────────────────

const WORKFLOW_SECTIONS: { key: keyof NonNullable<BlueprintObject['fieldWorkflow']>; label: string }[] = [
  { key: 'preTask',      label: 'Pre-Task' },
  { key: 'layout',       label: 'Layout' },
  { key: 'excavation',   label: 'Excavation' },
  { key: 'installation', label: 'Installation' },
  { key: 'backfill',     label: 'Backfill' },
  { key: 'testing',      label: 'Testing' },
  { key: 'inspection',   label: 'Inspection' },
  { key: 'asBuilt',      label: 'As-Built' },
];

function WorkflowTab({ object }: { object: BlueprintObject }) {
  if (!object.fieldWorkflow) {
    return (
      <div className="tab-content tab-content--empty">
        <p>No workflow steps added yet.</p>
        <p className="empty-hint">Foreman workflow steps will be added as plan-set data is linked.</p>
      </div>
    );
  }

  const wf = object.fieldWorkflow;
  const activeSections = WORKFLOW_SECTIONS.filter((s) => (wf[s.key]?.length ?? 0) > 0);

  return (
    <div className="tab-content">
      {activeSections.map(({ key, label }, idx) => (
        <div key={key} className="workflow-section">
          <div className="workflow-section__step">{idx + 1}</div>
          <div className="workflow-section__content">
            <div className="workflow-section__title">{label}</div>
            <ul className="workflow-list">
              {wf[key]!.map((item, i) => (
                <li key={i} className="workflow-item">{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Checklist ────────────────────────────────────────────────────────────

const PHASE_ORDER: NonNullable<ChecklistItem['phase']>[] = ['install', 'backfill', 'inspect', 'as-built'];
const PHASE_LABELS: Record<NonNullable<ChecklistItem['phase']>, string> = {
  install: 'Install',
  backfill: 'Backfill',
  inspect: 'Inspection',
  'as-built': 'As-Built',
};

function ChecklistTab({
  object,
  status,
  onSetStatus,
}: {
  object: BlueprintObject;
  status: ObjectStatus;
  onSetStatus: (id: string, s: ObjectStatus) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const items = object.checklist ?? [];

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <div className="tab-content tab-content--empty">
        <p>No checklist items yet.</p>
        <p className="empty-hint">Inspection checklists will be added when plan-set data is imported.</p>
      </div>
    );
  }

  const grouped = PHASE_ORDER.reduce<Record<string, ChecklistItem[]>>((acc, p) => {
    acc[p] = items.filter((i) => (i.phase ?? 'install') === p);
    return acc;
  }, { install: [], backfill: [], inspect: [], 'as-built': [] });

  const totalDone = checked.size;

  return (
    <div className="tab-content">
      {/* Overall status control */}
      <div className="checklist-status">
        <span className="checklist-status__label">Field Status</span>
        <div className="checklist-status__btns">
          {(['not_started', 'in_progress', 'done'] as ObjectStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`status-btn status-btn--${s}${status === s ? ' status-btn--active' : ''}`}
              onClick={() => onSetStatus(object.id, s)}
            >
              {s === 'not_started' ? 'Not Started' : s === 'in_progress' ? 'In Progress' : 'Done'}
            </button>
          ))}
        </div>
        <div className="checklist-progress">
          <div className="checklist-progress__bar">
            <div
              className="checklist-progress__fill"
              style={{ width: `${items.length ? (totalDone / items.length) * 100 : 0}%` }}
            />
          </div>
          <span className="checklist-progress__label">{totalDone} / {items.length} checked</span>
        </div>
      </div>

      {PHASE_ORDER.map((phase) => {
        const phaseItems = grouped[phase];
        if (phaseItems.length === 0) return null;
        return (
          <div key={phase} className="detail-section">
            <div className="detail-section__title">{PHASE_LABELS[phase]}</div>
            {phaseItems.map((item) => (
              <label key={item.id} className="checklist-item">
                <input
                  type="checkbox"
                  checked={checked.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="checklist-item__checkbox"
                />
                <span className={`checklist-item__label${checked.has(item.id) ? ' checklist-item__label--done' : ''}`}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        );
      })}

      <div className="field-tip">
        <Lightbulb size={14} className="field-tip__icon" />
        <p>Check items as you complete each step. Status change is independent — use "Done" when the whole item is accepted.</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type ObjectDetailsPanelProps = {
  object: BlueprintObject | null;
  verticalDesignBasis?: VerticalDesignBasis;
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
  verticalDesignBasis,
  distanceFt,
  status,
  onSetStatus,
  calibrationPoints,
  gps,
  onAddCalibrationPoint,
  onClearCalibration,
}: ObjectDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('summary');

  // Determine which tabs have data
  function tabHasData(id: TabId): boolean {
    if (!object) return false;
    switch (id) {
      case 'summary':   return true;
      case 'specs':     return Boolean(
        (object.dimensions && Object.values(object.dimensions).some(Boolean)) ||
        (object.materials  && Object.values(object.materials).some(Boolean)) ||
        object.concreteThickness || object.width || object.rockThickness
      );
      case 'safety':    return Boolean(
        (object.warnings?.length ?? 0) > 0 ||
        (object.safetyFlag && object.safetyFlag !== 'none')
      );
      case 'details':   return (object.detailRefs?.length ?? 0) > 0;
      case 'workflow':  return Boolean(object.fieldWorkflow);
      case 'checklist': return true;
    }
  }

  if (!object) {
    return (
      <aside className="right-sidebar">
        <div className="empty-state-panel">
          <div className="empty-state-panel__icon">📍</div>
          <p className="empty-state-panel__title">Tap any object on the map</p>
          <p className="empty-state-panel__hint">Manholes, catch basins, pipes, curbs, flatwork, and more — all have field detail information.</p>
        </div>
        <CalibrationPanel
          calibrationPoints={calibrationPoints}
          selectedObject={null}
          gps={gps}
          onAddPoint={onAddCalibrationPoint}
          onClearPoints={onClearCalibration}
        />
      </aside>
    );
  }

  return (
    <aside className="right-sidebar">
      {/* Foreman summary strip */}
      <ForemanStrip object={object} distanceFt={distanceFt} />

      {/* Tabs */}
      <div className="detail-tabs" role="tablist">
        {ALL_TABS.map((tab) => {
          const hasData = tabHasData(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`detail-tab${activeTab === tab.id ? ' detail-tab--active' : ''}${!hasData ? ' detail-tab--empty' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {hasData && tab.id !== 'summary' && tab.id !== 'checklist' && (
                <span className="detail-tab__dot" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      <div className="detail-tab-body">
        {activeTab === 'summary'   && <SummaryTab object={object} distanceFt={distanceFt} verticalDesignBasis={verticalDesignBasis} />}
        {activeTab === 'specs'     && <SpecsTab     object={object} />}
        {activeTab === 'safety'    && <SafetyTab    object={object} />}
        {activeTab === 'details'   && <DetailsTab   object={object} />}
        {activeTab === 'workflow'  && <WorkflowTab  object={object} />}
        {activeTab === 'checklist' && <ChecklistTab object={object} status={status} onSetStatus={onSetStatus} />}
      </div>

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
