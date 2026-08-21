import { Crosshair, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BlueprintObject, JobsitePackage, ObjectStatus, Point } from '../types/jobsite';
import { distanceFeet, formatFeet } from '../utils/distance';
import { GRADING_HIT_RADIUS, layoutGradingLabels, type GradingLabelLayout } from '../lib/gradingLayout';
import { PdfPlanLayer } from './PdfPlanLayer';

export type ImportedBasePlan = {
  url: string;
  name: string;
  mimeType: string;
};

type PlanCanvasProps = {
  jobsite: JobsitePackage;
  userLocation: Point;
  userHeading: number;
  isLayerVisible: (layerId: string) => boolean;
  isPhaseVisible: (phase?: string) => boolean;
  getObjectStatus: (objectId: string) => ObjectStatus;
  selectedObjectId: string | null;
  onSelectObject: (id: string) => void;
  recenterToken: number;
  importedBasePlan?: ImportedBasePlan | null;
};

const HIT_RADIUS_FT = 8;

function StatusBadge({ x, y, status }: { x: number; y: number; status: ObjectStatus }) {
  if (status === 'not_started') return null;
  const bx = x + 3;
  const by = y - 3;
  if (status === 'done') {
    return (
      <g>
        <circle cx={bx} cy={by} r={1.7} fill="#34a853" stroke="#fff" strokeWidth={0.4} />
        <path
          d={`M ${bx - 0.85} ${by} l 0.55 0.55 l 1.05 -1.15`}
          stroke="#fff"
          strokeWidth={0.45}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    );
  }
  return <circle cx={bx} cy={by} r={1.7} fill="#f9ab00" stroke="#fff" strokeWidth={0.4} />;
}

function ObjectIcon({
  obj,
  selected,
  color,
  status,
  labelLayout,
  onClick,
}: {
  obj: BlueprintObject;
  selected: boolean;
  color: string;
  status: ObjectStatus;
  labelLayout?: GradingLabelLayout;
  onClick: (e: React.MouseEvent) => void;
}) {
  const { x, y, type } = obj;
  const fill = selected ? '#ea4335' : color;
  const stroke = '#fff';
  const sw = 0.5;

  const selectionRing = selected ? (
    <circle cx={x} cy={y} r={6} fill="none" stroke="#ea4335" strokeWidth={0.9} />
  ) : null;

  let icon: React.ReactNode;

  if (type === 'manhole') {
    icon = (
      <>
        {selectionRing}
        <circle cx={x} cy={y} r={selected ? 2.8 : 2.4} fill={fill} stroke={stroke} strokeWidth={sw} />
        <line x1={x - 1.4} y1={y} x2={x + 1.4} y2={y} stroke={stroke} strokeWidth={0.5} />
        <line x1={x} y1={y - 1.4} x2={x} y2={y + 1.4} stroke={stroke} strokeWidth={0.5} />
      </>
    );
  } else if (type === 'catch_basin') {
    const s = selected ? 3.2 : 2.8;
    icon = (
      <>
        {selectionRing}
        <polygon
          points={`${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      </>
    );
  } else if (type === 'building_pad') {
    const s = selected ? 3.2 : 2.8;
    icon = (
      <>
        {selectionRing}
        <rect x={x - s} y={y - s} width={s * 2} height={s * 2} fill={fill} stroke={stroke} strokeWidth={sw} />
      </>
    );
  } else if (type === 'property_corner') {
    const s = 2.8;
    icon = (
      <>
        {selectionRing}
        <line x1={x - s} y1={y - s} x2={x + s} y2={y + s} stroke={fill} strokeWidth={1.5} strokeLinecap="round" />
        <line x1={x + s} y1={y - s} x2={x - s} y2={y + s} stroke={fill} strokeWidth={1.5} strokeLinecap="round" />
        <circle cx={x} cy={y} r={1} fill={fill} />
      </>
    );
  } else if (type === 'slope_marker') {
    icon = (
      <>
        {selectionRing}
        <polygon
          points={`${x},${y - 3.5} ${x + 2.5},${y + 2} ${x - 2.5},${y + 2}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      </>
    );
  } else if (type === 'fdc') {
    const r = selected ? 3 : 2.6;
    const pentagonPoints = Array.from({ length: 5 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      return `${x + r * Math.cos(angle)},${y + r * Math.sin(angle)}`;
    }).join(' ');
    icon = (
      <>
        {selectionRing}
        <polygon points={pentagonPoints} fill={fill} stroke={stroke} strokeWidth={sw} />
      </>
    );
  } else if (type === 'vault') {
    const r = selected ? 3 : 2.6;
    const hexagonPoints = Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 6;
      return `${x + r * Math.cos(angle)},${y + r * Math.sin(angle)}`;
    }).join(' ');
    icon = (
      <>
        {selectionRing}
        <polygon points={hexagonPoints} fill={fill} stroke={stroke} strokeWidth={sw} />
      </>
    );
  } else if (type === 'drywell') {
    // double ring — signifies deep excavation
    const r = selected ? 3.4 : 2.9;
    icon = (
      <>
        {selectionRing}
        <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
        <circle cx={x} cy={y} r={r * 0.5} fill="none" stroke={stroke} strokeWidth={0.6} />
      </>
    );
  } else if (type === 'cleanout') {
    // small square with center dot
    const s = selected ? 2.6 : 2.2;
    icon = (
      <>
        {selectionRing}
        <rect x={x - s} y={y - s} width={s * 2} height={s * 2} fill={fill} stroke={stroke} strokeWidth={sw} />
        <circle cx={x} cy={y} r={0.6} fill={stroke} />
      </>
    );
  } else if (type === 'hydrant') {
    // pentagon
    const r = selected ? 3 : 2.6;
    const pts = Array.from({ length: 5 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      return `${x + r * Math.cos(angle)},${y + r * Math.sin(angle)}`;
    }).join(' ');
    icon = (
      <>
        {selectionRing}
        <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} />
      </>
    );
  } else if (type === 'gate_valve') {
    // rotated square (diamond) with a cross
    const s = selected ? 2.8 : 2.4;
    icon = (
      <>
        {selectionRing}
        <polygon
          points={`${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
        <line x1={x - 1.2} y1={y} x2={x + 1.2} y2={y} stroke={stroke} strokeWidth={0.5} />
      </>
    );
  } else if (type === 'meter' || type === 'fire_service') {
    // small circle with filled center
    const r = selected ? 2.8 : 2.4;
    icon = (
      <>
        {selectionRing}
        <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
        <circle cx={x} cy={y} r={r * 0.35} fill={stroke} />
      </>
    );
  } else if (type === 'light_pole') {
    // star / cross symbol
    const r = selected ? 2.8 : 2.4;
    icon = (
      <>
        {selectionRing}
        <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
        <line x1={x} y1={y - r} x2={x} y2={y + r} stroke={stroke} strokeWidth={0.5} />
        <line x1={x - r} y1={y} x2={x + r} y2={y} stroke={stroke} strokeWidth={0.5} />
      </>
    );
  } else if (type === 'stockpile') {
    // triangle pointing up
    const s = selected ? 3.5 : 3;
    icon = (
      <>
        {selectionRing}
        <polygon
          points={`${x},${y - s} ${x + s},${y + s * 0.6} ${x - s},${y + s * 0.6}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      </>
    );
  } else if (type === 'parking_lot') {
    // P inside a rounded square — pavement zone marker
    const s = selected ? 3.4 : 2.9;
    icon = (
      <>
        {selectionRing}
        <rect x={x - s} y={y - s} width={s * 2} height={s * 2} rx={0.8} fill={fill} stroke={stroke} strokeWidth={sw} />
        <text
          x={x}
          y={y + 1.1}
          textAnchor="middle"
          fontSize={s * 1.1}
          fontWeight="bold"
          fill={stroke}
          fontFamily="monospace"
          style={{ pointerEvents: 'none' }}
        >P</text>
      </>
    );
  } else if (type === 'curb') {
    // Horizontal bar with two end ticks — symbolizes curb face
    const s = selected ? 3.4 : 2.8;
    icon = (
      <>
        {selectionRing}
        <rect x={x - s} y={y - 1.0} width={s * 2} height={2} rx={0.4} fill={fill} stroke={stroke} strokeWidth={sw} />
        <line x1={x - s} y1={y - 1.8} x2={x - s} y2={y + 1.8} stroke={fill} strokeWidth={1.2} strokeLinecap="round" />
        <line x1={x + s} y1={y - 1.8} x2={x + s} y2={y + 1.8} stroke={fill} strokeWidth={1.2} strokeLinecap="round" />
      </>
    );
  } else if (type === 'sidewalk') {
    // Hatched square — represents a concrete slab section
    const s = selected ? 3.2 : 2.7;
    icon = (
      <>
        {selectionRing}
        <rect x={x - s} y={y - s} width={s * 2} height={s * 2} fill={fill} stroke={stroke} strokeWidth={sw} />
        <line x1={x - s} y1={y} x2={x + s} y2={y} stroke={stroke} strokeWidth={0.5} />
        <line x1={x} y1={y - s} x2={x} y2={y + s} stroke={stroke} strokeWidth={0.5} />
      </>
    );
  } else if (type === 'grade_break') {
    // Triangle pointing up for high point, down for low point
    const s = selected ? 3.6 : 3.0;
    const gb = obj as BlueprintObject & { gradeBreakType?: string };
    const isLow = gb.gradeBreakType === 'low_point';
    icon = (
      <>
        {selectionRing}
        {isLow
          ? <polygon points={`${x},${y + s} ${x + s},${y - s * 0.6} ${x - s},${y - s * 0.6}`} fill={fill} stroke={stroke} strokeWidth={sw} />
          : <polygon points={`${x},${y - s} ${x + s},${y + s * 0.6} ${x - s},${y + s * 0.6}`} fill={fill} stroke={stroke} strokeWidth={sw} />
        }
        <line x1={x - 1.2} y1={y} x2={x + 1.2} y2={y} stroke={stroke} strokeWidth={0.6} />
      </>
    );
  } else if (type === 'control_point' || type === 'ada_ramp' || type === 'construction_entrance') {
    // X mark
    const s = 2.6;
    icon = (
      <>
        {selectionRing}
        <line x1={x - s} y1={y - s} x2={x + s} y2={y + s} stroke={fill} strokeWidth={1.5} strokeLinecap="round" />
        <line x1={x + s} y1={y - s} x2={x - s} y2={y + s} stroke={fill} strokeWidth={1.5} strokeLinecap="round" />
        <circle cx={x} cy={y} r={1} fill={fill} />
      </>
    );
  } else {
    // elevation and others — plain circle
    icon = (
      <>
        {selectionRing}
        <circle cx={x} cy={y} r={selected ? 2.5 : 2.2} fill={fill} stroke={stroke} strokeWidth={sw} />
      </>
    );
  }

  const isGrading = obj.layerId === 'grading';
  return (
    <g
      className="plan-object"
      data-object-id={obj.id}
      data-label-suppressed={labelLayout?.suppressed ? 'true' : 'false'}
      onClick={onClick}
    >
      {isGrading && (
        <circle
          className="plan-object-hit-target"
          cx={x}
          cy={y}
          r={GRADING_HIT_RADIUS}
          fill="transparent"
          pointerEvents="none"
        />
      )}
      {icon}
      <StatusBadge x={x} y={y} status={status} />
      {(!labelLayout || !labelLayout.suppressed) && <text
        className={isGrading ? 'grading-map-label' : undefined}
        x={labelLayout?.labelX ?? x}
        y={labelLayout?.labelY ?? y - 5}
        textAnchor="middle"
        fontSize="3.2"
        fill={selected ? '#ea4335' : '#202124'}
        fontWeight={selected ? 'bold' : 'normal'}
        fontFamily="Arial, sans-serif"
        style={{ pointerEvents: 'none' }}
      >
        {obj.workerLabel ?? obj.label}
      </text>}
    </g>
  );
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function PlanCanvas({
  jobsite,
  userLocation,
  userHeading,
  isLayerVisible,
  isPhaseVisible,
  getObjectStatus,
  selectedObjectId,
  onSelectObject,
  recenterToken,
  importedBasePlan,
}: PlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.9);
  const [offset, setOffset] = useState({ x: 20, y: 20 });
  const [dragging, setDragging] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [showSourcePdf, setShowSourcePdf] = useState(true);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  // Touch state stored in ref to avoid stale closures in the passive-false listener
  const touchRef = useRef<{
    touches: { x: number; y: number }[];
    initialDist: number;
    initialScale: number;
    startOffset: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  const { plan, utilities, objects } = jobsite;
  const gradingLabels = useMemo(() => new Map(layoutGradingLabels(
    objects.filter((object) => object.layerId === 'grading').map((object) => ({
      id: object.id,
      x: object.x,
      y: object.y,
      text: object.workerLabel ?? object.label,
    })),
    { width: plan.widthFt, height: plan.heightFt },
  ).map((label) => [label.id, label])), [objects, plan.heightFt, plan.widthFt]);
  const importedPdf = Boolean(importedBasePlan && (
    importedBasePlan.mimeType === 'application/pdf' || /\.pdf(?:$|[?#])/i.test(importedBasePlan.url)
  ));
  const selectedObject = objects.find((o) => o.id === selectedObjectId) ?? null;
  const distance = selectedObject ? distanceFeet(userLocation, selectedObject) : null;

  const handlePdfDocumentLoaded = useCallback((pageCount: number) => {
    setPdfPageCount(pageCount);
    setPdfPage((page) => Math.min(page, pageCount));
  }, []);

  const recenterOnUser = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // Zoom to 1.5× so field markers are clearly visible but context is still readable
    const s = Math.max(1.0, Math.min(rect.width / plan.widthFt, rect.height / plan.heightFt) * 1.5); // plan is destructured above
    setScale(s);
    setOffset({
      x: rect.width / 2 - userLocation.x * s,
      y: rect.height / 2 - userLocation.y * s,
    });
  }, [userLocation, plan.widthFt, plan.heightFt]);

  // Refit whenever a newly published semantic package changes the plan extent.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const s = Math.min(rect.width / plan.widthFt, rect.height / plan.heightFt) * 0.95;
    const fittedScale = Math.max(0.3, s);
    setScale(fittedScale);
    setOffset({
      x: (rect.width - plan.widthFt * fittedScale) / 2,
      y: (rect.height - plan.heightFt * fittedScale) / 2,
    });
  }, [plan.heightFt, plan.widthFt]);

  useEffect(() => {
    if (recenterToken > 0) recenterOnUser();
  }, [recenterToken, recenterOnUser]);

  // Non-passive touchmove listener so we can call preventDefault (prevents page scroll during pan/pinch)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!touchRef.current) return;

      const ts = Array.from(e.touches).map((t) => ({ x: t.clientX, y: t.clientY }));

      if (ts.length === 1) {
        const dx = ts[0].x - touchRef.current.touches[0].x;
        const dy = ts[0].y - touchRef.current.touches[0].y;
        if (Math.hypot(dx, dy) > 4) touchRef.current.moved = true;
        setOffset({
          x: touchRef.current.startOffset.x + dx,
          y: touchRef.current.startOffset.y + dy,
        });
      } else if (ts.length === 2 && touchRef.current.initialDist > 0) {
        const dist = Math.hypot(ts[1].x - ts[0].x, ts[1].y - ts[0].y);
        const factor = dist / touchRef.current.initialDist;
        setScale(() => {
          const next = touchRef.current!.initialScale * factor;
          return Math.min(8, Math.max(1.5, next));
        });
        touchRef.current.moved = true;
      }
    };

    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleTouchMove);
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale((s) => Math.min(8, Math.max(1.5, s + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, offsetX: offset.x, offsetY: offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.offsetX + (e.clientX - dragStart.current.x),
      y: dragStart.current.offsetY + (e.clientY - dragStart.current.y),
    });
  };

  const handleMouseUp = () => setDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const ts = Array.from(e.touches).map((t) => ({ x: t.clientX, y: t.clientY }));
    if (ts.length === 1) {
      touchRef.current = {
        touches: ts,
        initialDist: 0,
        initialScale: scale,
        startOffset: { ...offset },
        moved: false,
      };
      setDragging(true);
    } else if (ts.length === 2) {
      touchRef.current = {
        touches: ts,
        initialDist: Math.hypot(ts[1].x - ts[0].x, ts[1].y - ts[0].y),
        initialScale: scale,
        startOffset: { ...offset },
        moved: false,
      };
      setDragging(false);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // If it was a tap (not a drag), treat it as a map click
    if (touchRef.current && !touchRef.current.moved && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const planPt = {
          x: (t.clientX - rect.left - offset.x) / scale,
          y: (t.clientY - rect.top - offset.y) / scale,
        };
        const hit = objects.find(
          (obj) =>
            isLayerVisible(obj.layerId) && isPhaseVisible(obj.phase) && distanceFeet(planPt, obj) <= HIT_RADIUS_FT,
        );
        if (hit) onSelectObject(hit.id);
      }
    }
    touchRef.current = null;
    setDragging(false);
  };

  const screenToPlan = (clientX: number, clientY: number): Point => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: (clientX - rect.left - offset.x) / scale,
      y: (clientY - rect.top - offset.y) / scale,
    };
  };

  const handleMapClick = (e: React.MouseEvent) => {
    if (dragging) return;
    const point = screenToPlan(e.clientX, e.clientY);
    const hit = objects.find(
      (obj) =>
        isLayerVisible(obj.layerId) && isPhaseVisible(obj.phase) && distanceFeet(point, obj) <= HIT_RADIUS_FT,
    );
    if (hit) onSelectObject(hit.id);
  };

  const mid = selectedObject ? midpoint(userLocation, selectedObject) : null;

  return (
    <div className="plan-canvas-wrapper">
      {importedBasePlan && (
        <div className="imported-plan-status" role="status">
          <strong>{importedBasePlan.name}</strong>
          <span>Imported base sheet · field overlays hidden until reviewed and calibrated</span>
          {importedPdf && pdfPageCount > 1 && (
            <div className="imported-plan-pages" aria-label="PDF page controls">
              <button type="button" onClick={() => setPdfPage((page) => Math.max(1, page - 1))} disabled={pdfPage === 1}>Previous</button>
              <span>Page {pdfPage} of {pdfPageCount}</span>
              <button type="button" onClick={() => setPdfPage((page) => Math.min(pdfPageCount, page + 1))} disabled={pdfPage === pdfPageCount}>Next</button>
            </div>
          )}
          {importedPdf && (
            <label className="imported-plan-source-toggle">
              <input
                type="checkbox"
                checked={showSourcePdf}
                onChange={(event) => setShowSourcePdf(event.target.checked)}
              />
              Show source PDF
            </label>
          )}
          {pdfError && <span className="imported-plan-error">{pdfError}</span>}
        </div>
      )}
      <div className="compass" aria-hidden="true">
        <span className="compass__arrow">↑</span>
        <span className="compass__label">N</span>
      </div>

      <div
        ref={containerRef}
        className={`plan-canvas ${dragging ? 'plan-canvas--dragging' : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleMapClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="plan-canvas__transform"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        >
          {importedBasePlan ? (
            importedPdf ? (
              <PdfPlanLayer
                key={importedBasePlan.url}
                url={importedBasePlan.url}
                pageNumber={pdfPage}
                width={plan.widthFt}
                zoom={scale}
                showSourcePdf={showSourcePdf}
                onDocumentLoaded={handlePdfDocumentLoaded}
                onError={setPdfError}
              />
            ) : (
              <img
                src={importedBasePlan.url}
                alt={`Imported civil plan: ${importedBasePlan.name}`}
                className="plan-canvas__image"
                width={plan.widthFt}
                height={plan.heightFt}
                draggable={false}
              />
            )
          ) : (
            <img
              src={plan.imageUrl}
              alt="Jobsite plan"
              className="plan-canvas__image"
              width={plan.widthFt}
              height={plan.heightFt}
              draggable={false}
            />
          )}

          <svg
            className="plan-canvas__overlay"
            viewBox={`0 0 ${plan.widthFt} ${plan.heightFt}`}
            width={plan.widthFt}
            height={plan.heightFt}
          >
            {!importedBasePlan && utilities.map((line) => {
              if (!isLayerVisible(line.layerId)) return null;
              const inPhase = isPhaseVisible(line.phase);
              const layer = jobsite.layers.find((l) => l.id === line.layerId);
              const pts = line.points.map((p) => `${p.x},${p.y}`).join(' ');
              const isClosed =
                line.points.length > 2 &&
                line.points[0].x === line.points[line.points.length - 1].x &&
                line.points[0].y === line.points[line.points.length - 1].y;

              return (
                <g key={line.id} opacity={inPhase ? 1 : 0.2}>
                  {isClosed ? (
                    <polygon
                      points={pts}
                      fill={layer?.color ?? '#999'}
                      fillOpacity={0.08}
                      stroke="none"
                    />
                  ) : (
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={layer?.color ?? '#999'}
                      strokeWidth={line.layerId === 'water-pipe' ? 2.5 : 2}
                      strokeLinecap="round"
                    />
                  )}
                  {line.label && line.points[0] && (
                    <text
                      x={line.points[0].x + 2}
                      y={line.points[0].y - 2}
                      fontSize="3.5"
                      fill={layer?.color ?? '#666'}
                      fontFamily="Arial, sans-serif"
                    >
                      {line.label}
                    </text>
                  )}
                </g>
              );
            })}

            {!importedBasePlan && selectedObject && mid && (
              <>
                <line
                  x1={userLocation.x}
                  y1={userLocation.y}
                  x2={selectedObject.x}
                  y2={selectedObject.y}
                  stroke="#ea4335"
                  strokeWidth={0.6}
                  strokeDasharray="2,1.5"
                />
                {distance !== null && (
                  <text
                    x={mid.x}
                    y={mid.y - 2}
                    textAnchor="middle"
                    fontSize="4"
                    fill="#ea4335"
                    fontWeight="bold"
                    fontFamily="Arial, sans-serif"
                  >
                    {formatFeet(distance)}
                  </text>
                )}
              </>
            )}

            {!importedBasePlan && objects.map((obj) => {
              if (!isLayerVisible(obj.layerId)) return null;
              const inPhase = isPhaseVisible(obj.phase);
              const layer = jobsite.layers.find((l) => l.id === obj.layerId);
              const selected = obj.id === selectedObjectId;
              // dim out-of-phase objects rather than hiding them
              const opacity = inPhase ? 1 : 0.22;
              return (
                <g key={obj.id} opacity={opacity} style={{ pointerEvents: obj.layerId === 'grading' ? 'none' : inPhase ? 'auto' : 'none' }}>
                  <ObjectIcon
                    obj={obj}
                    selected={selected}
                    color={layer?.color ?? '#5f6368'}
                    status={getObjectStatus(obj.id)}
                    labelLayout={gradingLabels.get(obj.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectObject(obj.id);
                    }}
                  />
                </g>
              );
            })}

            {/* User location is only trustworthy after the imported plan is reviewed and calibrated. */}
            {!importedBasePlan && <g transform={`translate(${userLocation.x}, ${userLocation.y})`}>
              <circle r={4} fill="#1a73e8" fillOpacity={0.18} />
              <circle r={2} fill="#1a73e8" stroke="#fff" strokeWidth={0.6} />
              <polygon
                points="0,-4.5 1.4,1.2 -1.4,1.2"
                fill="#1a73e8"
                transform={`rotate(${userHeading})`}
              />
            </g>}
          </svg>
        </div>
      </div>

      <div className="map-controls">
        <button
          type="button"
          className="map-controls__btn"
          onClick={() => setScale((s) => Math.min(8, s + 0.4))}
          aria-label="Zoom in"
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          className="map-controls__btn"
          onClick={() => setScale((s) => Math.max(1.5, s - 0.4))}
          aria-label="Zoom out"
        >
          <Minus size={18} />
        </button>
        <button
          type="button"
          className="map-controls__btn"
          onClick={recenterOnUser}
          aria-label="Re-center on my location"
        >
          <Crosshair size={18} />
        </button>
      </div>
    </div>
  );
}
