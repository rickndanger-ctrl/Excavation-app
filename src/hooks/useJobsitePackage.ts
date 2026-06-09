import { useCallback, useState } from 'react';
import { sampleWillowCreek } from '../data/sampleWillowCreek';
import type { JobsitePackage } from '../types/jobsite';
import { getJobsitePackage, isOfflineReady, saveJobsitePackage } from '../utils/storage';

export function useJobsitePackage() {
  const [offlineReady, setOfflineReady] = useState(isOfflineReady);
  const [downloading, setDownloading] = useState(false);

  const downloadPlans = useCallback(async () => {
    setDownloading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    saveJobsitePackage(sampleWillowCreek);
    setOfflineReady(true);
    setDownloading(false);
  }, []);

  // Always use the fresh sample during development.
  // Ignore any cached package that is Cedar Grove or has outdated plan dimensions.
  const cached = getJobsitePackage();
  // Missing flatwork types means cache pre-dates these features.
  const hasFlatworkData = cached?.objects?.some(
    (o) => o.type === 'curb' || o.type === 'sidewalk' || o.type === 'grade_break'
  ) ?? false;
  const hasParkingData = cached?.objects?.some((o) => o.type === 'parking_lot') ?? false;

  const isStale =
    !cached ||
    cached.id === 'cedar-grove-apartments' ||
    cached.plan.widthFt > 600 || // old 1536-pixel coordinate space
    !hasFlatworkData ||           // missing curb/sidewalk data
    !hasParkingData;              // missing parking lot zones
  const activePackage: JobsitePackage = isStale ? sampleWillowCreek : cached;

  return { offlineReady, downloading, downloadPlans, activePackage };
}
