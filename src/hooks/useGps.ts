import { useEffect, useState } from 'react';

export type GpsState = {
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  heading: number | null;
  available: boolean;
  active: boolean;
  error: string | null;
};

const INITIAL: GpsState = {
  lat: null,
  lng: null,
  accuracyM: null,
  heading: null,
  available: typeof navigator !== 'undefined' && 'geolocation' in navigator,
  active: false,
  error: null,
};

export function useGps(): GpsState {
  const [state, setState] = useState<GpsState>(INITIAL);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          heading: pos.coords.heading,
          available: true,
          active: true,
          error: null,
        });
      },
      (err) => {
        setState((prev) => ({ ...prev, error: err.message, active: false }));
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return state;
}
