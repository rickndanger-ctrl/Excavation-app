import { Crosshair, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BlueprintObject, JobsitePackage, ObjectStatus, Point } from '../types/jobsite';
import { distanceFeet, formatFeet } from '../utils/distance';
import { distanceToFeature } from '../lib/spatialGeometry';
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
  showSemanticOverlaysWithBasePlan?: boolean;
};

const HIT_RADIUS_FT = 8;

function isSemanticObject(object: BlueprintObject): boolean {
  return Boolean(object.geometry) || ['grading', 'sanitary', 'storm', 'water', 'dry-utility'].includes(object.layerId);
}

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

  if (obj.symbol === 'sanitary-manhole') {
    icon = <g className="sanitary-symbol--manhole">{selectionRing}<circle cx={x} cy={y} r={2.8} fill={fill} stroke={stroke} strokeWidth={sw} /><circle cx={x} cy={y} r={1.8} fill="none" stroke={stroke} strokeWidth={0.45} /><text x={x} y={y + 0.9} textAnchor="middle" fontSize="2.5" fontWeight="bold" fill={stroke}>S</text></g>;
  } else if (obj.symbol === 'sanitary-cleanout') {
    icon = <g className="sanitary-symbol--cleanout">{selectionRing}<circle cx={x} cy={y} r={2.8} fill={fill} stroke={stroke} strokeWidth={sw} /><circle cx={x} cy={y} r={1.8} fill="none" stroke={stroke} strokeWidth={0.45} /><text x={x} y={y + 0.8} textAnchor="middle" fontSize="2.1" fontWeight="bold" fill={stroke}>CO</text></g>;
  } else if (obj.symbol === 'sanitary-pipe') {
    icon = <g className="sanitary-symbol--pipe">{selectionRing}<circle cx={x} cy={y} r={2.5} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={x - 3.5} y1={y} x2={x + 3.5} y2={y} stroke={stroke} strokeWidth={0.8} /></g>;
  } else if (obj.symbol === 'storm-manhole') {
    icon = <g className="storm-symbol--manhole">{selectionRing}<circle cx={x} cy={y} r={2.8} fill={fill} stroke={stroke} strokeWidth={sw} /><circle cx={x} cy={y} r={1.8} fill="none" stroke={stroke} strokeWidth={0.45} /><text x={x} y={y + 0.9} textAnchor="middle" fontSize="2.4" fontWeight="bold" fill={stroke}>D</text></g>;
  } else if (obj.symbol === 'storm-catch-basin') {
    icon = <g className="storm-symbol--catch-basin">{selectionRing}<polygon points={`${x},${y - 3} ${x + 3},${y} ${x},${y + 3} ${x - 3},${y}`} fill={fill} stroke={stroke} strokeWidth={sw} /><text x={x} y={y + 0.75} textAnchor="middle" fontSize="1.8" fontWeight="bold" fill={stroke}>CB</text></g>;
  } else if (obj.symbol === 'water-gate') {
    icon = <g className="water-symbol--gate">{selectionRing}<polygon points={`${x},${y - 3} ${x + 3},${y} ${x},${y + 3} ${x - 3},${y}`} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={x - 1.5} y1={y} x2={x + 1.5} y2={y} stroke={stroke} strokeWidth={0.55} /><line x1={x} y1={y - 1.5} x2={x} y2={y + 1.5} stroke={stroke} strokeWidth={0.55} /></g>;
  } else if (obj.symbol === 'dry-light-bollard') {
    icon = <g className="dry-symbol--light-bollard">{selectionRing}<circle cx={x} cy={y} r={2.8} fill={fill} stroke={stroke} strokeWidth={sw}/><line x1={x} y1={y-1.8} x2={x} y2={y+1.8} stroke={stroke} strokeWidth={0.6}/><line x1={x-1.8} y1={y} x2={x+1.8} y2={y} stroke={stroke} strokeWidth={0.6}/></g>;
  } else if (type === 'manhole') {
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

  const isSemantic = isSemanticObject(obj);
  return (
    <g
      className="plan-object"
      data-object-id={obj.id}
      data-layer-id={obj.layerId}
      data-label-suppressed={labelLayout?.suppressed ? 'true' : 'false'}
      onClick={onClick}
    >
      {isSemantic && (
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
      {(selected || !labelLayout || !labelLayout.suppressed) && <text
        className={isSemantic ? 'grading-map-label' : undefined}
        data-label-priority={obj.labelPriority ?? 0}
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

function semanticPolygonStyle(obj: BlueprintObject, fallbackColor: string, selected: boolean) {
  if (obj.layerId !== 'finished-site') {
    return {
      fill: fallbackColor,
      fillOpacity: selected ? 0.28 : 0.12,
      stroke: selected ? '#ea4335' : fallbackColor,
      strokeWidth: selected ? 1.2 : 0.7,
      labelColor: selected ? '#ea4335' : fallbackColor,
    };
  }

  const styles: Record<string, { fill: string; stroke: string; fillOpacity: number; labelColor: string }> = {
    building_footprint: { fill: '#334155', stroke: '#0f172a', fillOpacity: 0.82, labelColor: '#ffffff' },
    existing_concrete_walk: { fill: '#d6d3d1', stroke: '#78716c', fillOpacity: 0.88, labelColor: '#44403c' },
    existing_concrete_sidewalk: { fill: '#d6d3d1', stroke: '#78716c', fillOpacity: 0.88, labelColor: '#44403c' },
    cement_concrete_pavement: { fill: '#e7e5e4', stroke: '#78716c', fillOpacity: 0.92, labelColor: '#44403c' },
    unit_paver_area: { fill: '#d6b98c', stroke: '#8b6f47', fillOpacity: 0.92, labelColor: '#5c452b' },
    planting_area: { fill: '#7fa36b', stroke: '#527146', fillOpacity: 0.84, labelColor: '#294325' },
    existing_lawn_area: { fill: '#a7c99a', stroke: '#64845a', fillOpacity: 0.78, labelColor: '#36522f' },
  };
  const style = styles[obj.type] ?? { fill: '#94a3b8', stroke: '#475569', fillOpacity: 0.48, labelColor: '#334155' };
  return {
    ...style,
    fillOpacity: selected ? Math.min(1, style.fillOpacity + 0.1) : style.fillOpacity,
    stroke: selected ? '#ea4335' : style.stroke,
    strokeWidth: selected ? 1.5 : 0.9,
    labelColor: selected ? '#ea4335' : style.labelColor,
  };
}

function showOverviewLabel(obj: BlueprintObject, selected: boolean, suppressed: boolean): boolean {
  if (selected) return true;
  if (obj.layerId !== 'finished-site') return !suppressed;
  if (obj.geometry?.type === 'LineString') return false;
  return obj.type === 'building_footprint' || (obj.type === 'unit_paver_area' && !suppressed);
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
  showSemanticOverlaysWithBasePlan = false,
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
  const mouseMoved = useRef(false);

  // Touch state stored in ref to avoid stale closures in the passive-false listener
  const touchRef = useRef<{
    touches: { x: number; y: number }[];
    initialDist: number;
    initialScale: number;
    startOffset: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  const { plan, utilities, objects } = jobsite;
  const renderObjects = useMemo(() => [...objects].sort((left, right) => {
    const rank = (object: BlueprintObject) => {
      if (object.layerId !== 'finished-site') return 2;
      return object.geometry?.type === 'Polygon' ? 0 : 1;
    };
    return rank(left) - rank(right);
  }), [objects]);
  const nearestVisibleObject = useCallback((point: Point) => objects
    .filter((obj) => isLayerVisible(obj.layerId) && isPhaseVisible(obj.phase))
    .map((obj) => ({ obj, distance: distanceToFeature(point, obj) }))
    .filter(({ distance }) => distance <= HIT_RADIUS_FT)
    .sort((left, right) => left.distance - right.distance)[0]?.obj, [isLayerVisible, isPhaseVisible, objects]);
  const semanticLabels = useMemo(() => new Map(layoutGradingLabels(
    objects.filter((object) => isSemanticObject(object) && isLayerVisible(object.layerId) && isPhaseVisible(object.phase)).map((object) => ({
      id: object.id,
      x: object.x,
      y: object.y,
      text: object.workerLabel ?? object.label,
      priority: object.labelPriority,
    })),
    { width: plan.widthFt, height: plan.heightFt },
  ).map((label) => [label.id, label])), [isLayerVisible, isPhaseVisible, objects, plan.heightFt, plan.widthFt]);
  const importedPdf = Boolean(importedBasePlan && (
    importedBasePlan.mimeType === 'application/pdf' || /\.pdf(?:$|[?#])/i.test(importedBasePlan.url)
  ));
  const renderSemanticOverlays = !importedBasePlan || showSemanticOverlaysWithBasePlan;
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

  const fitPlanToContainer = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const s = Math.min(rect.width / plan.widthFt, rect.height / plan.heightFt) * 0.95;
    const fittedScale = Math.max(0.3, s);
    setScale(fittedScale);
    setOffset({
      x: (rect.width - plan.widthFt * fittedScale) / 2,
      y: (rect.height - plan.heightFt * fittedScale) / 2,
    });
  }, [plan.heightFt, plan.widthFt]);

  // Refit whenever the package extent or the actual map viewport changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    fitPlanToContainer();
    const observer = new ResizeObserver(fitPlanToContainer);
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitPlanToContainer]);

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
    mouseMoved.current = false;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, offsetX: offset.x, offsetY: offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    if (Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y) > 4) mouseMoved.current = true;
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
        const hit = nearestVisibleObject(planPt);
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
    if (mouseMoved.current) return;
    const point = screenToPlan(e.clientX, e.clientY);
    const hit = nearestVisibleObject(point);
    if (hit) onSelectObject(hit.id);
  };

  const mid = selectedObject ? midpoint(userLocation, selectedObject) : null;

  return (
    <div className="plan-canvas-wrapper">
      {importedBasePlan && (
        <div className="imported-plan-status" role="status">
          <strong>{importedBasePlan.name}</strong>
          <span>{showSemanticOverlaysWithBasePlan ? 'Imported base sheet · approved semantic overlays remain visible' : 'Imported base sheet · field overlays hidden until reviewed and calibrated'}</span>
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
          ) : plan.imageUrl ? (
            <img
              src={plan.imageUrl}
              alt="Jobsite plan"
              className="plan-canvas__image"
              width={plan.widthFt}
              height={plan.heightFt}
              draggable={false}
            />
          ) : (
            <div
              className="semantic-plan-background"
              style={{ width: plan.widthFt, height: plan.heightFt }}
              aria-label="Semantic model background"
            />
          )}

          <svg
            className="plan-canvas__overlay"
            viewBox={`0 0 ${plan.widthFt} ${plan.heightFt}`}
            width={plan.widthFt}
            height={plan.heightFt}
          >
            {renderSemanticOverlays && utilities.map((line) => {
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
                      className={line.layerId === 'sanitary' ? 'sanitary-line' : undefined}
                      points={pts}
                      fill="none"
                      stroke={layer?.color ?? '#999'}
                      strokeWidth={line.layerId === 'water-pipe' ? 2.5 : 2}
                      strokeLinecap="round"
                    />
                  )}
                  {line.label && line.layerId !== 'sanitary' && line.points[0] && (
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

            {renderSemanticOverlays && selectedObject && mid && (
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

            {renderSemanticOverlays && renderObjects.map((obj) => {
              if (!isLayerVisible(obj.layerId)) return null;
              const inPhase = isPhaseVisible(obj.phase);
              const layer = jobsite.layers.find((l) => l.id === obj.layerId);
              const selected = obj.id === selectedObjectId;
              // dim out-of-phase objects rather than hiding them
              const opacity = inPhase ? 1 : 0.22;
              const color = layer?.color ?? '#5f6368';
              const geometry = obj.geometry;
              const labelLayout = semanticLabels.get(obj.id);
              if (geometry?.type === 'Polygon') {
                const style = semanticPolygonStyle(obj, color, selected);
                return <g key={obj.id} className="semantic-feature semantic-feature--polygon" data-object-id={obj.id} data-layer-id={obj.layerId} data-geometry-type="Polygon" data-label-suppressed={labelLayout?.suppressed ? 'true' : 'false'} opacity={opacity}>
                  <polygon points={geometry.coordinates.map((point) => `${point.x},${point.y}`).join(' ')} fill={style.fill} fillOpacity={style.fillOpacity} stroke={style.stroke} strokeWidth={style.strokeWidth} onClick={(event) => { event.stopPropagation(); onSelectObject(obj.id); }} />
                  {showOverviewLabel(obj, selected, Boolean(labelLayout?.suppressed)) && <text className="semantic-map-label" x={selected ? obj.x : labelLayout?.labelX ?? obj.x} y={selected ? obj.y : labelLayout?.labelY ?? obj.y} textAnchor="middle" fontSize={obj.type === 'building_footprint' ? '3.7' : '3.2'} fontWeight={obj.type === 'building_footprint' ? '700' : undefined} fill={style.labelColor} pointerEvents="none">{obj.workerLabel ?? obj.label}</text>}
                </g>;
              }
              if (geometry?.type === 'LineString') {
                return <g key={obj.id} className="semantic-feature semantic-feature--line" data-object-id={obj.id} data-layer-id={obj.layerId} data-geometry-type="LineString" data-label-suppressed={labelLayout?.suppressed ? 'true' : 'false'} opacity={opacity}>
                  <polyline points={geometry.coordinates.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={selected ? '#ea4335' : color} strokeWidth={selected ? 2.2 : 1.4} strokeLinecap="round" onClick={(event) => { event.stopPropagation(); onSelectObject(obj.id); }} />
                  {showOverviewLabel(obj, selected, Boolean(labelLayout?.suppressed)) && <text className="semantic-map-label" x={selected ? obj.x : labelLayout?.labelX ?? obj.x} y={selected ? obj.y - 2 : labelLayout?.labelY ?? obj.y - 2} textAnchor="middle" fontSize="3.2" fill={selected ? '#ea4335' : color} pointerEvents="none">{obj.workerLabel ?? obj.label}</text>}
                </g>;
              }
              return <g key={obj.id} opacity={opacity} data-geometry-type="Point" style={{ pointerEvents: inPhase ? 'auto' : 'none' }}>
                <ObjectIcon obj={obj} selected={selected} color={color} status={getObjectStatus(obj.id)} labelLayout={labelLayout} onClick={(e) => { e.stopPropagation(); onSelectObject(obj.id); }} />
              </g>;
            })}

            {/* User location is only trustworthy after the imported plan is reviewed and calibrated. */}
            {renderSemanticOverlays && <g transform={`translate(${userLocation.x}, ${userLocation.y})`}>
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
