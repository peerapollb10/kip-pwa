import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKip } from '../context/KipContext.jsx';
import { detectPlatform } from '../lib/device.js';
import InstallBanner from '../components/InstallBanner.jsx';

const IOS_SHORTCUT_URL = import.meta.env.VITE_IOS_SHORTCUT_URL || '#';

const SLIDES = {
  ios: [
    { media: 'ios-install', demo: '📲', title: 'เพิ่ม Kip ลงหน้าจอโฮม', steps: ['เปิด Kip ใน Safari', 'แตะปุ่มแชร์ (สี่เหลี่ยมลูกศรขึ้น)', 'เลือก “เพิ่มไปยังหน้าจอโฮม”'] },
    { media: 'ios-share', demo: '⤴️', title: 'เพิ่ม Kip ใน Share Sheet', steps: ['ติดตั้งคำสั่งลัด “Save to Kip” จากปุ่มด้านล่าง', 'ในแอปใดก็ได้ แตะแชร์ → เลือก “Save to Kip”', 'ปักหมุดไว้แถวบนสุดเพื่อกดได้ใน 1 คลิก'], cta: { label: 'ติดตั้งคำสั่งลัด Save to Kip', href: IOS_SHORTCUT_URL } },
    { media: 'save', demo: '🗂️', title: 'เลือกหมวดหมู่ตอนเซฟ', steps: ['Kip จะเด้ง Bottom Sheet ให้เลือกหมวด', 'ผู้ใช้ Pro เปิด Quick Mode ให้เซฟเข้าหมวด “ทั่วไป” อัตโนมัติได้'] },
  ],
  android: [
    { media: 'android-install', demo: '📲', title: 'ติดตั้ง Kip ลงหน้าจอหลัก', steps: ['แตะปุ่ม “ติดตั้ง” ด้านบน', 'หรือเมนู ⋮ ใน Chrome → “ติดตั้งแอป”'] },
    { media: 'android-share', demo: '⤴️', title: 'แชร์จากแอปไหนก็ได้', steps: ['ใน YouTube / Facebook / Chrome แตะ “แชร์”', 'เลือกไอคอน Kip ใน Share Sheet', 'กดค้างเพื่อปักหมุด Kip ไว้ด้านบน'] },
    { media: 'save', demo: '🗂️', title: 'เลือกหมวดหมู่ตอนเซฟ', steps: ['Kip จะเด้ง Bottom Sheet ให้เลือกหมวด', 'ผู้ใช้ Pro เปิด Quick Mode ให้เซฟเข้าหมวด “ทั่วไป” อัตโนมัติได้'] },
  ],
  desktop: [
    { media: 'desktop-install', demo: '💻', title: 'ติดตั้ง Kip เป็น Desktop App', steps: ['คลิกไอคอน ⊕ ที่แถบที่อยู่ของ Chrome / Edge', 'หรือกดปุ่ม “ติดตั้ง” ด้านบน', 'Kip จะเปิดเป็นหน้าต่างแยกเหมือนแอปทั่วไป'] },
    { media: 'desktop-drag', demo: '🖱️', title: 'ลากแล้ววาง', steps: ['ลากลิงก์จากแถบที่อยู่ หรือรูปภาพ', 'วางลงในหน้าต่าง Kip ได้ทันที'] },
    { media: 'desktop-paste', demo: '⌨️', title: 'วางด้วย Ctrl / ⌘ + V', steps: ['คัดลอกลิงก์หรือรูปภาพ', 'กด Ctrl/⌘ + V ที่ไหนก็ได้ในหน้า Kip', 'เลือกหมวดหมู่ แล้วกดเซฟ'] },
  ],
};

// Short silent looping clip; falls back to an animated illustration if the asset is missing.
function LoopMedia({ name, demo }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[260px] overflow-hidden rounded-[2rem] border-4 border-slate-900 bg-gradient-to-b from-brand-50 to-white shadow-xl dark:border-white/20 dark:from-brand-700/30 dark:to-[#16161d]">
      {!failed ? (
        <video key={name} src={`/onboarding/${name}.mp4`} autoPlay muted loop playsInline preload="auto" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center">
          <span className="animate-tap text-7xl">{demo}</span>
          <div className="absolute inset-x-3 bottom-3 animate-slide-up-loop rounded-2xl bg-white p-3 shadow-lg dark:bg-[#22222b]">
            <div className="mb-2 h-2 w-16 rounded bg-slate-200 dark:bg-white/20" />
            <div className="flex gap-1.5">
              {['📚', '🎬', '💼', '🛍️'].map((e) => (
                <span key={e} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/10">{e}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Onboarding() {
  const { profile, saveProfile } = useKip();
  const navigate = useNavigate();
  const [platform, setPlatform] = useState(detectPlatform);
  const [index, setIndex] = useState(0);
  const slides = SLIDES[platform];
  const slide = slides[index];
  const last = index === slides.length - 1;

  async function finish() {
    if (profile && !profile.onboarded) await saveProfile({ onboarded: true }).catch(() => {});
    navigate('/', { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mb-4 flex items-center justify-between">
        <select className="rounded-lg bg-transparent text-xs text-slate-500" value={platform} onChange={(e) => { setPlatform(e.target.value); setIndex(0); }} aria-label="อุปกรณ์">
          <option value="ios">iPhone / iPad</option>
          <option value="android">Android</option>
          <option value="desktop">คอมพิวเตอร์</option>
        </select>
        <button className="btn-ghost px-2 text-sm" onClick={finish}>ข้าม</button>
      </div>

      <InstallBanner />

      <div className="mt-6 flex-1">
        <LoopMedia key={`${platform}-${index}`} name={slide.media} demo={slide.demo} />
        <h1 className="mt-6 text-center text-xl font-bold">{slide.title}</h1>
        <ol className="mx-auto mt-3 max-w-xs space-y-2 text-sm text-slate-600 dark:text-slate-300">
          {slide.steps.map((s, i) => (
            <li key={s} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        {slide.cta && (
          <a href={slide.cta.href} className="btn-outline mx-auto mt-4 flex w-fit" target="_blank" rel="noopener noreferrer">{slide.cta.label}</a>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)} aria-label={`สไลด์ ${i + 1}`} className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-brand-600' : 'w-2 bg-slate-300 dark:bg-white/20'}`} />
          ))}
        </div>
        <button className="btn-primary min-w-28" onClick={() => (last ? finish() : setIndex(index + 1))}>
          {last ? 'เริ่มใช้งาน' : 'ถัดไป'}
        </button>
      </div>
    </div>
  );
}
