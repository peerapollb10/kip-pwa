import { useEffect, useState } from 'react';
import { detectPlatform, isStandalone } from '../lib/device.js';

// Captures the Chromium `beforeinstallprompt` event so we can offer a one-tap install.
let deferredPrompt = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

export default function InstallBanner() {
  const [canPrompt, setCanPrompt] = useState(Boolean(deferredPrompt));
  const [installed, setInstalled] = useState(isStandalone());
  const platform = detectPlatform();

  useEffect(() => {
    const onPrompt = () => setCanPrompt(true);
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    deferredPrompt = null;
    setCanPrompt(false);
  }

  const hint = {
    ios: 'แตะปุ่มแชร์ ⎋ ใน Safari แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”',
    android: 'แตะเมนู ⋮ ใน Chrome แล้วเลือก “ติดตั้งแอป”',
    desktop: 'คลิกไอคอน ⊕ ที่แถบที่อยู่ของ Chrome/Edge เพื่อติดตั้ง Kip',
  }[platform];

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 p-3.5 text-white shadow-lg">
      <img src="/icons/icon.svg" alt="" className="h-10 w-10 rounded-xl bg-white/20 p-1" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">ติดตั้ง Kip เป็นแอป</p>
        <p className="text-xs text-white/80">{canPrompt ? 'เปิดเร็ว ใช้แชร์จากแอปอื่นได้ทันที' : hint}</p>
      </div>
      {canPrompt && (
        <button onClick={install} className="btn shrink-0 bg-white px-3 py-1.5 text-brand-700">
          ติดตั้ง
        </button>
      )}
    </div>
  );
}
