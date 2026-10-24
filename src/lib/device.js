// Detect platform for adaptive onboarding: 'ios' | 'android' | 'desktop'.
export function detectPlatform(nav = typeof navigator !== 'undefined' ? navigator : {}) {
  const ua = nav.userAgent || '';
  // iPadOS 13+ reports itself as Mac; touch support gives it away.
  const isIPadOS = nav.platform === 'MacIntel' && (nav.maxTouchPoints || 0) > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || isIPadOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

// On iOS, "Add to Home Screen" is most reliable from Safari; in-app browsers (LINE, Facebook)
// and other browsers either lack it or hide it elsewhere.
export function isIOSSafari(nav = typeof navigator !== 'undefined' ? navigator : {}) {
  const ua = nav.userAgent || '';
  return detectPlatform(nav) === 'ios' && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|Line\/|FBAN|FBAV|Instagram/i.test(ua);
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}
