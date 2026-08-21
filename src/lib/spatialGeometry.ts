import type { BlueprintObject, Point } from '../types/jobsite';

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (((a.y > point.y) !== (b.y > point.y)) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function distanceToFeature(point: Point, feature: BlueprintObject): number {
  const geometry = feature.geometry;
  if (!geometry || geometry.type === 'Point') {
    const target = geometry?.coordinates ?? feature;
    return Math.hypot(point.x - target.x, point.y - target.y);
  }
  if (geometry.type === 'Polygon' && pointInPolygon(point, geometry.coordinates)) return 0;
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < geometry.coordinates.length; index += 1) {
    nearest = Math.min(nearest, distanceToSegment(point, geometry.coordinates[index - 1], geometry.coordinates[index]));
  }
  return nearest;
}
