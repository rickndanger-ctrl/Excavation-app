import { OVERVIEW_PHASE_ID, type ExcavationLayer } from '../types/jobsite';

type LayerFeature = { layerId: string; phase?: string };

export function layersAvailableForPhase(
  layers: ExcavationLayer[],
  features: LayerFeature[],
  activePhaseId: string,
): ExcavationLayer[] {
  return layers.filter((layer) => features.some((feature) =>
    feature.layerId === layer.id && (
      activePhaseId === OVERVIEW_PHASE_ID || !feature.phase || feature.phase === activePhaseId
    ),
  ));
}
