import { useCallback, useState } from 'react';
import { sampleJobsite } from '../data/sampleJobsite';
import type { JobsitePackage } from '../types/jobsite';
import { getJobsitePackage, isOfflineReady, saveJobsitePackage } from '../utils/storage';

export function useJobsitePackage() {
  const [offlineReady, setOfflineReady] = useState(isOfflineReady);
  const [downloading, setDownloading] = useState(false);

  const downloadPlans = useCallback(async () => {
    setDownloading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    saveJobsitePackage(sampleJobsite);
    setOfflineReady(true);
    setDownloading(false);
  }, []);

  const activePackage: JobsitePackage = getJobsitePackage() ?? sampleJobsite;

  return { offlineReady, downloading, downloadPlans, activePackage };
}
