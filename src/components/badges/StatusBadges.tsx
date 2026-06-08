import { AlertTriangle, CloudOff, Crosshair } from 'lucide-react';

type StatusBadgesProps = {
  offlineReady: boolean;
};

export function StatusBadges({ offlineReady }: StatusBadgesProps) {
  return (
    <div className="status-badges">
      <span className={`badge badge--offline ${offlineReady ? 'badge--active' : ''}`}>
        <CloudOff size={14} />
        Offline Mode Ready
      </span>
      <span className="badge badge--gps">
        <Crosshair size={14} />
        GPS Guidance
      </span>
      <span className="badge badge--verify">
        <AlertTriangle size={14} />
        Verify with control points
      </span>
    </div>
  );
}
