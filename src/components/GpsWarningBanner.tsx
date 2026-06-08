export function GpsWarningBanner() {
  return (
    <div className="gps-warning-banner" role="alert">
      Offline GPS location is for field guidance only. Confirm exact locations with survey
      stakes, control points, offsets, curb lines, building corners, property corners, or
      approved layout.
    </div>
  );
}
