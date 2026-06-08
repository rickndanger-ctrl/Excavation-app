import { Battery, Map } from 'lucide-react';
import { useEffect, useState } from 'react';

type StatusBarProps = {
  gpsAccuracyM: number | null;
  gpsActive: boolean;
  calibrated: boolean;
};

export function StatusBar({ gpsAccuracyM, gpsActive, calibrated }: StatusBarProps) {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const gpsLabel = () => {
    if (!gpsActive) return 'GPS searching…';
    const ft = gpsAccuracyM !== null ? Math.round(gpsAccuracyM * 3.281) : null;
    return ft !== null ? `GPS ±${ft} ft` : 'GPS active';
  };

  return (
    <footer className="status-bar">
      <div className="status-bar__left">
        <span className="status-bar__item">
          <Battery size={14} />
          100%
        </span>
        <span className={`status-bar__item ${gpsActive ? 'status-bar__gps--active' : 'status-bar__gps'}`}>
          {gpsLabel()}
        </span>
        {calibrated && (
          <span className="status-bar__item status-bar__calibrated">Plan Calibrated</span>
        )}
      </div>
      <div className="status-bar__center">{time}</div>
      <div className="status-bar__right">
        <span className="status-bar__item">
          <Map size={14} />
          Offline Maps
        </span>
        <span className="status-bar__version">v2.2.0</span>
      </div>
    </footer>
  );
}
