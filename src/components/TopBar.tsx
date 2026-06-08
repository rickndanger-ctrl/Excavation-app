import { Menu } from 'lucide-react';
import { StatusBadges } from './badges/StatusBadges';

type TopBarProps = {
  projectName: string;
  offlineReady: boolean;
};

export function TopBar({ projectName, offlineReady }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <button type="button" className="icon-btn" aria-label="Menu">
          <Menu size={20} />
        </button>
        <h1 className="top-bar__title">EveSite 2D – Field Excavation Map</h1>
      </div>
      <StatusBadges offlineReady={offlineReady} />
      <div className="top-bar__project">Project: {projectName}</div>
    </header>
  );
}
