import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useKip } from '../context/KipContext.jsx';
import { supabase } from '../lib/supabase.js';
import { Toggle, TypeBadge } from '../components/ui.jsx';
import CategoryManager from '../components/CategoryManager.jsx';
import FeedbackModal from '../components/FeedbackModal.jsx';
import SupportLinks from '../components/SupportLinks.jsx';
import { FREE_ITEM_LIMIT } from '../lib/pricing.js';
import { getTheme, setTheme } from '../lib/theme.js';
import { ITEM_TYPES, OPTIONAL_TYPES } from '../lib/content.js';

const TYPE_LABEL = Object.fromEntries(ITEM_TYPES);

function Section({ title, children }) {
  return (
    <section className="card mb-4 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

export default function Settings() {
  const { user, isGuest, isAdmin, migrating, profile, isPro, items, saveProfile, setUpgradeOpen, showToast, enabledTypes, setTypeEnabled } = useKip();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [theme, setThemeState] = useState(getTheme);
  const navigate = useNavigate();

  function chooseTheme(next) {
    setTheme(next);
    setThemeState(next);
  }

  async function toggleQuickMode(next) {
    if (!isPro) return setUpgradeOpen(true);
    try {
      await saveProfile({ quick_mode: next });
    } catch {
      showToast('บันทึกไม่สำเร็จ', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link to="/" className="btn-ghost -ml-3 mb-2">← กลับ</Link>
      <h1 className="mb-4 text-2xl font-bold">ตั้งค่า</h1>

      <Section title="บัญชี">
        {isGuest ? (
          <>
            <p className="text-sm font-medium">โหมด Guest</p>
            <p className="mt-0.5 text-xs text-slate-500">ข้อมูลเก็บอยู่ในเครื่องนี้เท่านั้น เชื่อมต่อบัญชีเพื่อสำรองและซิงก์ — ข้อมูลเดิมจะย้ายขึ้นให้อัตโนมัติ</p>
            <Link to="/login" state={{ from: '/settings' }} className="btn-primary mt-3 w-full">เชื่อมต่อด้วย Gmail / LINE</Link>
          </>
        ) : (
          <>
            <p className="text-sm">{user?.email?.endsWith('.invalid') ? `LINE · ${user.user_metadata?.full_name ?? ''}` : user?.email}</p>
            {migrating && <p className="mt-1 text-xs text-brand-600">กำลังย้ายข้อมูลจากโหมด Guest...</p>}
          </>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${isPro ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-white/10'}`}>
            {isPro
              ? profile.pro_until ? `Pro · ถึง ${new Date(profile.pro_until).toLocaleDateString('th-TH')}` : 'Pro · Lifetime'
              : `Free · ${items.length}/${FREE_ITEM_LIMIT} รายการ`}
          </span>
          <Link to="/pricing" className="text-sm font-medium text-brand-600">{isPro ? 'ดูแพ็กเกจ' : 'อัปเกรดเป็น Pro →'}</Link>
        </div>
        {isAdmin && <Link to="/admin" className="btn-outline mt-3 w-full">🛠 หลังบ้าน (Admin)</Link>}
      </Section>

      <Section title="การเซฟ">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">
              Quick Mode {!isPro && <span className="ml-1 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] text-white">PRO</span>}
            </p>
            <p className="text-xs text-slate-500">แชร์จากแอปอื่นแล้วเซฟทันที ไม่ต้องเลือกหมวดหมู่</p>
          </div>
          <Toggle checked={Boolean(isPro && profile?.quick_mode)} onChange={toggleQuickMode} />
        </div>
      </Section>

      <Section title="ประเภทคอนเทนต์เสริม">
        <p className="mb-3 text-xs text-slate-500">
          Facebook, โน้ต, รูปภาพ, YouTube และ Web Link เปิดใช้งานเสมอ — เปิดประเภทด้านล่างเพื่อแสดงในตัวกรอง (ถ้าปิดไว้ ลิงก์ประเภทนั้นจะเซฟเป็น Web Link)
        </p>
        <ul className="space-y-3" data-testid="optional-types">
          {OPTIONAL_TYPES.map((t) => (
            <li key={t} className="flex items-center justify-between">
              <TypeBadge type={t} />
              <Toggle checked={enabledTypes.includes(t)} onChange={(on) => setTypeEnabled(t, on)} label={TYPE_LABEL[t]} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="ธีม">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="ธีม">
          {[
            ['light', '☀️ Light'],
            ['dark', '🌙 Dark'],
          ].map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={theme === value} className={`btn ${theme === value ? 'bg-brand-600 text-white' : 'btn-outline'}`} onClick={() => chooseTheme(value)}>
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="หมวดหมู่">
        <CategoryManager />
      </Section>

      <Section title="ช่วยเหลือ">
        <button className="btn-outline mb-3 w-full" onClick={() => setFeedbackOpen(true)}>💬 ส่งข้อเสนอแนะ / แจ้งปัญหา</button>
        <SupportLinks />
        <Link to="/welcome" className="btn-ghost mt-2 px-0 text-xs">ดูวิธีตั้งค่า Share Sheet / ติดตั้งแอปอีกครั้ง</Link>
      </Section>

      {!isGuest && (
        <button
          className="btn-ghost w-full text-red-600"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate('/', { replace: true });
          }}
        >
          ออกจากระบบ
        </button>
      )}

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
