import { useEffect, useState } from 'react';
import { Sheet } from './ui.jsx';
import { detectPlatform, isIOSSafari } from '../lib/device.js';
import { useInstallPrompt } from '../lib/install.js';

const DISMISS_KEY = 'kip.installHint.dismissed';

// Show the Dashboard hint only on mobile browsers that haven't installed Kip and haven't dismissed it.
export function shouldShowInstallHint() {
  try {
    if (localStorage.getItem(DISMISS_KEY)) return false;
  } catch {
    /* storage unavailable */
  }
  return detectPlatform() !== 'desktop';
}

export function dismissInstallHint() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}

// iOS share icon (square + up arrow) and "Add to Home Screen" icon (plus in a rounded square).
const ShareIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);
const AddIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
const MenuIcon = () => <span className="text-lg font-bold leading-none" aria-hidden="true">⋮</span>;

function Steps({ steps }) {
  return (
    <ol className="space-y-2.5">
      {steps.map(([icon, text], i) => (
        <li key={i} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span>
          <span className="flex-1 text-sm">{text}</span>
          {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm dark:bg-white/10 dark:text-brand-100">{icon}</span>}
        </li>
      ))}
    </ol>
  );
}

function IOSGuide() {
  const safari = isIOSSafari();
  const onIOS = detectPlatform() === 'ios';
  return (
    <div data-testid="install-ios">
      {onIOS && !safari && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          ตอนนี้ไม่ได้เปิดใน Safari — คัดลอกลิงก์แล้วเปิดใน Safari ก่อน เพื่อให้มีเมนู “เพิ่มไปยังหน้าจอโฮม”
        </p>
      )}
      <Steps
        steps={[
          [<ShareIcon key="s" />, <>แตะปุ่ม <b>แชร์</b> ในแถบด้านล่างของ Safari (iPad อยู่มุมขวาบน)</>],
          [<AddIcon key="a" />, <>เลื่อนลงแล้วเลือก <b>“เพิ่มไปยังหน้าจอโฮม”</b> (Add to Home Screen)</>],
          [null, <>แตะ <b>“เพิ่ม”</b> มุมขวาบน — ไอคอน Kip จะอยู่บนหน้าจอโฮม</>],
        ]}
      />
      <p className="mt-3 text-xs text-slate-500">
        iOS ยังไม่รองรับการแชร์ลิงก์จากแอปอื่นเข้า PWA โดยตรง — ใช้คำสั่งลัด “Save to Kip” ในหน้าแนะนำการใช้งานแทน
      </p>
    </div>
  );
}

function AndroidGuide({ canPrompt, onInstall }) {
  return (
    <div data-testid="install-android">
      {canPrompt ? (
        <button className="btn-primary mb-3 w-full py-3 text-base" onClick={onInstall} data-testid="install-now">
          📲 ติดตั้งแอป Kip
        </button>
      ) : (
        <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
          ปุ่มติดตั้งทันทีจะขึ้นเมื่อเปิด Kip ใน Chrome — ถ้ายังไม่ขึ้น ติดตั้งเองได้ตามขั้นตอนด้านล่าง
        </p>
      )}
      <Steps
        steps={[
          [<MenuIcon key="m" />, <>แตะเมนู <b>⋮</b> มุมขวาบนของ Chrome</>],
          [<AddIcon key="a" />, <>เลือก <b>“ติดตั้งแอป”</b> หรือ <b>“เพิ่มลงในหน้าจอหลัก”</b></>],
          [null, <>หลังติดตั้ง แชร์ลิงก์จากแอปไหนก็ได้ แล้วเลือกไอคอน <b>Kip</b></>],
        ]}
      />
    </div>
  );
}

function DesktopGuide({ canPrompt, onInstall }) {
  return (
    <div data-testid="install-desktop">
      {canPrompt && (
        <button className="btn-primary mb-3 w-full py-3 text-base" onClick={onInstall} data-testid="install-now">
          💻 ติดตั้ง Kip บนคอมพิวเตอร์
        </button>
      )}
      <Steps
        steps={[
          [<AddIcon key="a" />, <>คลิกไอคอน <b>ติดตั้ง</b> ที่แถบที่อยู่ของ Chrome / Edge</>],
          [null, <>Kip จะเปิดเป็นหน้าต่างแยกเหมือนแอปทั่วไป</>],
        ]}
      />
    </div>
  );
}

const TABS = [
  ['ios', 'iPhone / iPad'],
  ['android', 'Android'],
  ['desktop', 'คอมพิวเตอร์'],
];

// Modal: OS-specific "Add to Home Screen" guide; one-tap install where the browser allows it.
export default function InstallGuide({ open, onClose }) {
  const [platform, setPlatform] = useState(detectPlatform);
  const { canPrompt, installed, promptInstall } = useInstallPrompt();

  useEffect(() => {
    if (open) setPlatform(detectPlatform());
  }, [open]);

  async function install() {
    const outcome = await promptInstall();
    if (outcome === 'accepted') onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="ติดตั้ง Kip ลงหน้าจอโฮม">
      <div data-testid="install-guide">
        <div className="mb-4 flex items-center gap-3">
          <img src="/icons/icon.svg" alt="" className="h-12 w-12 rounded-2xl shadow" />
          <p className="text-sm text-slate-600 dark:text-slate-300">เปิด Kip ได้จากหน้าจอโฮมแบบเต็มจอ เร็วกว่าเปิดผ่านเบราว์เซอร์ และแชร์ลิงก์เข้ามาได้ทันที</p>
        </div>

        {installed ? (
          <p className="rounded-2xl bg-emerald-50 p-4 text-center text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200" data-testid="install-done">
            ✓ ติดตั้ง Kip บนอุปกรณ์นี้แล้ว
          </p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/10" role="tablist" aria-label="อุปกรณ์">
              {TABS.map(([value, label]) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={platform === value}
                  onClick={() => setPlatform(value)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${platform === value ? 'bg-white shadow-sm dark:bg-[#22222b]' : 'text-slate-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {platform === 'ios' && <IOSGuide />}
            {platform === 'android' && <AndroidGuide canPrompt={canPrompt} onInstall={install} />}
            {platform === 'desktop' && <DesktopGuide canPrompt={canPrompt} onInstall={install} />}
          </>
        )}
      </div>
    </Sheet>
  );
}
