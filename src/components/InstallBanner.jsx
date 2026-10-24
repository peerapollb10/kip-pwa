import { useState } from 'react';
import { detectPlatform } from '../lib/device.js';
import { useInstallPrompt } from '../lib/install.js';
import InstallGuide from './InstallGuide.jsx';

export default function InstallBanner() {
  const { canPrompt, installed, promptInstall } = useInstallPrompt();
  const [guideOpen, setGuideOpen] = useState(false);
  const platform = detectPlatform();

  if (installed) return null;

  const hint = {
    ios: 'แตะปุ่มแชร์ ⎋ ใน Safari แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”',
    android: 'แตะเมนู ⋮ ใน Chrome แล้วเลือก “ติดตั้งแอป”',
    desktop: 'คลิกไอคอน ⊕ ที่แถบที่อยู่ของ Chrome/Edge เพื่อติดตั้ง Kip',
  }[platform];

  return (
    <>
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 p-3.5 text-white shadow-lg">
      <img src="/icons/icon.svg" alt="" className="h-10 w-10 rounded-xl bg-white/20 p-1" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">ติดตั้ง Kip เป็นแอป</p>
        <p className="text-xs text-white/80">{canPrompt ? 'เปิดเร็ว ใช้แชร์จากแอปอื่นได้ทันที' : hint}</p>
      </div>
      {canPrompt ? (
        <button onClick={promptInstall} className="btn shrink-0 bg-white px-3 py-1.5 text-brand-700">
          ติดตั้ง
        </button>
      ) : (
        <button onClick={() => setGuideOpen(true)} className="btn shrink-0 bg-white/20 px-3 py-1.5 text-white" data-testid="install-howto">
          ดูวิธี
        </button>
      )}
    </div>
    <InstallGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
