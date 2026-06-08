import { useCallback, useState } from 'react';
import type { ObjectStatus } from '../types/jobsite';
import { getObjectStatuses, saveObjectStatuses } from '../utils/storage';

export function useObjectStatus() {
  const [statuses, setStatuses] = useState<Record<string, ObjectStatus>>(() => getObjectStatuses());

  const setStatus = useCallback((objectId: string, status: ObjectStatus) => {
    setStatuses((prev) => {
      const updated = { ...prev, [objectId]: status };
      saveObjectStatuses(updated);
      return updated;
    });
  }, []);

  const getStatus = useCallback(
    (objectId: string): ObjectStatus => statuses[objectId] ?? 'not_started',
    [statuses],
  );

  return { statuses, setStatus, getStatus };
}
