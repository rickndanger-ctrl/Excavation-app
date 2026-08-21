import { useMemo, useState } from 'react';
import type { ExcavationLayer } from '../types/jobsite';

export function useLayerVisibility(layers: ExcavationLayer[]) {
  const initial = useMemo(
    () => Object.fromEntries(layers.map((l) => [l.id, l.defaultVisible])),
    [layers],
  );
  const [visibility, setVisibility] = useState<Record<string, boolean>>(initial);

  const toggleLayer = (layerId: string) => {
    setVisibility((prev) => ({ ...prev, [layerId]: !(prev[layerId] ?? true) }));
  };

  const isVisible = (layerId: string) => visibility[layerId] ?? true;

  return { visibility, toggleLayer, isVisible };
}
