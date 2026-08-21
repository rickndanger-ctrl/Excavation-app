export const GRADING_HIT_RADIUS = 7.5;

export type GradingLabelInput = { id: string; x: number; y: number; text: string; priority?: number };
export type GradingLabelLayout = GradingLabelInput & {
  labelX: number;
  labelY: number;
  suppressed: boolean;
  bounds: { left: number; right: number; top: number; bottom: number };
};

type Extent = { width: number; height: number };

const PLAN_PADDING = 2;
const LABEL_HEIGHT = 4.5;
const LABEL_GAP = 1.5;
const OFFSETS = [
  { x: 0, y: -7 },
  { x: 0, y: 8 },
  { x: 0, y: -14 },
  { x: 0, y: 15 },
  { x: 15, y: 0 },
  { x: -15, y: 0 },
] as const;

function intersects(
  left: GradingLabelLayout['bounds'],
  right: GradingLabelLayout['bounds'],
  gap = 0,
): boolean {
  return left.left < right.right + gap
    && left.right > right.left - gap
    && left.top < right.bottom + gap
    && left.bottom > right.top - gap;
}

function labelWidth(text: string): number {
  return Math.min(38, Math.max(9, text.length * 1.65));
}

function boundsAt(x: number, y: number, width: number): GradingLabelLayout['bounds'] {
  return { left: x - width / 2, right: x + width / 2, top: y - LABEL_HEIGHT, bottom: y };
}

export function layoutGradingLabels(inputs: GradingLabelInput[], extent: Extent): GradingLabelLayout[] {
  const occupied: GradingLabelLayout['bounds'][] = [];
  const markers = inputs.map((input) => ({
    id: input.id,
    bounds: { left: input.x - 3.5, right: input.x + 3.5, top: input.y - 3.5, bottom: input.y + 3.5 },
  }));

  const layouts = new Map<string, GradingLabelLayout>();
  const ordered = inputs.map((input, index) => ({ input, index })).sort((left, right) =>
    (right.input.priority ?? 0) - (left.input.priority ?? 0) || left.index - right.index);
  for (const { input } of ordered) {
    const width = labelWidth(input.text);
    for (const offset of OFFSETS) {
      const labelX = Math.min(extent.width - PLAN_PADDING - width / 2, Math.max(PLAN_PADDING + width / 2, input.x + offset.x));
      const labelY = Math.min(extent.height - PLAN_PADDING, Math.max(PLAN_PADDING + LABEL_HEIGHT, input.y + offset.y));
      const bounds = boundsAt(labelX, labelY, width);
      const collidesWithLabel = occupied.some((other) => intersects(bounds, other, LABEL_GAP));
      const obscuresFeature = markers.some((marker) => marker.id !== input.id && intersects(bounds, marker.bounds, 0.5));
      if (!collidesWithLabel && !obscuresFeature) {
        occupied.push(bounds);
        layouts.set(input.id, { ...input, labelX, labelY, suppressed: false, bounds });
        break;
      }
    }
    if (layouts.has(input.id)) continue;
    const fallbackX = Math.min(extent.width - PLAN_PADDING - width / 2, Math.max(PLAN_PADDING + width / 2, input.x));
    const fallbackY = Math.min(extent.height - PLAN_PADDING, Math.max(PLAN_PADDING + LABEL_HEIGHT, input.y - 7));
    layouts.set(input.id, { ...input, labelX: fallbackX, labelY: fallbackY, suppressed: true, bounds: boundsAt(fallbackX, fallbackY, width) });
  }
  return inputs.map((input) => layouts.get(input.id)!);
}
