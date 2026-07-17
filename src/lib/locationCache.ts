/**
 * Location cache — mulai fetch GPS sejak app dibuka,
 * supaya halaman kamera absen bisa langsung pakai tanpa nunggu.
 */

interface CachedPosition {
  lat: number;
  lng: number;
}

let cachedPosition: CachedPosition | null = null;
let cachedError: string | null = null;
let isResolved = false;
let isInitialized = false;

/** Panggil sekali saat app pertama kali dimuat */
export function initLocationCache() {
  if (isInitialized) return;
  isInitialized = true;

  if (!('geolocation' in navigator)) {
    cachedError = 'Geolocation not supported';
    isResolved = true;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      cachedPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      isResolved = true;
    },
    (error) => {
      cachedError = error.message;
      isResolved = true;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

export function getCachedPosition(): {
  position: CachedPosition | null;
  error: string | null;
  isReady: boolean;
} {
  return {
    position: cachedPosition,
    error: cachedError,
    isReady: isResolved,
  };
}
