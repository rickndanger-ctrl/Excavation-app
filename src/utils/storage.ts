import type {
  ControlPoint,
  ForemanNote,
  JobsitePackage,
  ObjectStatus,
  RockCalculatorInputs,
} from '../types/jobsite';

const KEYS = {
  jobsite: 'excavation-field-map:jobsite',
  notes: 'excavation-field-map:notes',
  calculator: 'excavation-field-map:calculator',
  calibration: 'excavation-field-map:calibration',
  objectStatus: 'excavation-field-map:object-status',
} as const;

export function saveJobsitePackage(pkg: JobsitePackage): void {
  const withTimestamp = { ...pkg, downloadedAt: new Date().toISOString() };
  localStorage.setItem(KEYS.jobsite, JSON.stringify(withTimestamp));
}

export function getJobsitePackage(): JobsitePackage | null {
  const raw = localStorage.getItem(KEYS.jobsite);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JobsitePackage;
  } catch {
    return null;
  }
}

export function isOfflineReady(): boolean {
  return getJobsitePackage() !== null;
}

export function getForemanNotes(): ForemanNote[] {
  const raw = localStorage.getItem(KEYS.notes);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ForemanNote[];
  } catch {
    return [];
  }
}

export function saveForemanNotes(notes: ForemanNote[]): void {
  localStorage.setItem(KEYS.notes, JSON.stringify(notes));
}

export function getCalculatorInputs(): RockCalculatorInputs | null {
  const raw = localStorage.getItem(KEYS.calculator);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RockCalculatorInputs;
  } catch {
    return null;
  }
}

export function saveCalculatorInputs(inputs: RockCalculatorInputs): void {
  localStorage.setItem(KEYS.calculator, JSON.stringify(inputs));
}

export function getObjectStatuses(): Record<string, ObjectStatus> {
  const raw = localStorage.getItem(KEYS.objectStatus);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, ObjectStatus>;
  } catch {
    return {};
  }
}

export function saveObjectStatuses(statuses: Record<string, ObjectStatus>): void {
  localStorage.setItem(KEYS.objectStatus, JSON.stringify(statuses));
}

export function getCalibrationPoints(): ControlPoint[] {
  const raw = localStorage.getItem(KEYS.calibration);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ControlPoint[];
  } catch {
    return [];
  }
}

export function saveCalibrationPoints(points: ControlPoint[]): void {
  localStorage.setItem(KEYS.calibration, JSON.stringify(points));
}
