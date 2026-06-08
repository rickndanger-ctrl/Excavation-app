import type { ControlPoint, GpsCoord, Point } from '../types/jobsite';

function gpsOffset(from: GpsCoord, to: GpsCoord): Point {
  const R = 6371000;
  const dLat = (to.lat - from.lat) * (Math.PI / 180) * R;
  const dLng =
    (to.lng - from.lng) *
    (Math.PI / 180) *
    R *
    Math.cos(from.lat * (Math.PI / 180));
  return { x: dLng, y: -dLat };
}

export type CalibrationTransform = (gps: GpsCoord) => Point;

export function buildCalibration(points: ControlPoint[]): CalibrationTransform | null {
  const anchors = points.filter((p) => p.gpsCoord != null);
  if (anchors.length < 2) return null;

  const a = anchors[0];
  const b = anchors[1];

  const gOff = gpsOffset(a.gpsCoord!, b.gpsCoord!);
  const pOff = {
    x: b.planPoint.x - a.planPoint.x,
    y: b.planPoint.y - a.planPoint.y,
  };

  const gLen = Math.hypot(gOff.x, gOff.y);
  const pLen = Math.hypot(pOff.x, pOff.y);
  if (gLen < 0.001) return null;

  const scale = pLen / gLen;
  const gAngle = Math.atan2(gOff.y, gOff.x);
  const pAngle = Math.atan2(pOff.y, pOff.x);
  const rotation = pAngle - gAngle;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return (gps: GpsCoord): Point => {
    const off = gpsOffset(a.gpsCoord!, gps);
    return {
      x: a.planPoint.x + (off.x * cos - off.y * sin) * scale,
      y: a.planPoint.y + (off.x * sin + off.y * cos) * scale,
    };
  };
}
