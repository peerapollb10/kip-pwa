import { useEffect, useState } from 'react';
import { isStandalone } from './device.js';

// Chromium fires `beforeinstallprompt` once, early — capture it at module load (imported from
// main.jsx) so a one-tap "Install" button works whenever the guide is opened later.
let deferredPrompt = null;
let installed = isStandalone();
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}

// Shows the native install dialog. Resolves 'accepted' | 'dismissed' | 'unavailable'.
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  const prompt = deferredPrompt;
  deferredPrompt = null; // a prompt event can only be used once
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  if (outcome === 'accepted') installed = true;
  notify();
  return outcome;
}

export function useInstallPrompt() {
  const read = () => ({ canPrompt: Boolean(deferredPrompt), installed });
  const [state, setState] = useState(read);
  useEffect(() => {
    const update = () => setState(read());
    listeners.add(update);
    update();
    return () => listeners.delete(update);
  }, []);
  return { ...state, promptInstall };
}
