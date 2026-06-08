import type { Point } from '../types/jobsite';

export function distanceFeet(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function bearingLabel(a: Point, b: Point): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const normalized = ((angle % 360) + 360) % 360;

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

export function formatFeet(distance: number): string {
  return `${Math.round(distance)} ft`;
}
