import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useKip } from '../context/KipContext.jsx';
import { adminListSlips, adminReviewSlip, adminSearchUsers, adminSetPlan, adminStats } from '../lib/api.js';
import { EmptyState, Spinner } from '../components/ui.jsx';

const DURATIONS = [
  ['month', '1 เดือน'],
  ['year', '1 ปี'],
  ['lifetime', 'Lifetime'],
];

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

const isActivePro = (u) => u.subscription_tier === 'pro' && (!u.pro_until || new Date(u.pro_until) > new Date());

function StatCard({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function OverrideForm({ user, onDone }) {
  const { showToast } = useKip();
  const [tier, setTier] = useState(isActivePro(user) ? 'pro' : 'free');
  const [duration, setDuration] = useState('month');
  const [note, setNote] = useState(user.admin_note || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await adminSetPlan({ userId: user.id, tier, duration, note: note.trim() });
      showToast('อัปเดตแพ็กเกจแล้ว ✓');
      onDone();
    } catch (e) {
      showToast(`บันทึกไม่สำเร็จ: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
      <div className="flex gap-2" role="radiogroup" aria-label="แพ็กเกจ">
        {['pro', 'free'].map((t) => (
          <button key={t} role="radio" aria-checked={tier === t} className={`${tier === t ? 'chip-on' : 'chip-off'} flex-1 justify-center`} onClick={() => setTier(t)}>
            {t === 'pro' ? 'Pro' : 'Free'}
          </button>
        ))}
      </div>
      {tier === 'pro' && (
        <div className="flex gap-2" role="radiogroup" aria-label="ระยะเวลา">
          {DURATIONS.map(([d, label]) => (
            <button key={d} role="radio" aria-checked={duration === d} className={`${duration === d ? 'chip-on' : 'chip-off'} flex-1 justify-center`} onClick={() => setDuration(d)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <textarea className="input min-h-[64px] resize-none" placeholder="Note กำกับ (เช่น ชดเชยระบบล่ม, โอนผ่านธนาคาร #123)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      <button className="btn-primary w-full" disabled={saving} onClick={save}>
        {saving ? <Spinner className="border-white border-t-transparent" /> : 'บันทึก Manual Override'}
      </button>
    </div>
  );
}

function UserRow({ user, onChanged }) {
  const [open, setOpen] = useState(false);
  const pro = isActivePro(user);
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.email || '(ไม่มีอีเมล)'}</p>
          <p className="truncate font-mono text-xs text-slate-400">{user.id}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${pro ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-white/10'}`}>
              {pro ? 'Pro' : 'Free'}
            </span>
            {pro && <span>{user.pro_until ? `ถึง ${new Date(user.pro_until).toLocaleDateString('th-TH')}` : 'Lifetime'}</span>}
            <span>· {user.item_count} รายการ</span>
            {user.payment_method && <span>· {user.payment_method}</span>}
            {user.role === 'admin' && <span className="rounded bg-amber-100 px-1.5 text-amber-700">admin</span>}
          </p>
          {user.admin_note && <p className="mt-1 text-xs italic text-slate-500">📝 {user.admin_note}</p>}
        </div>
        <button className="btn-outline shrink-0 px-3 py-1.5 text-xs" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'ปิด' : 'Manual Override'}
        </button>
      </div>
      {open && (
        <OverrideForm
          user={user}
          onDone={() => {
            setOpen(false);
            onChanged();
          }}
        />
      )}
    </li>
  );
}

const SLIP_FILTERS = [
  ['pending', 'รออนุมัติ'],
  ['approved', 'อนุมัติแล้ว'],
  ['rejected', 'ปฏิเสธแล้ว'],
];

function SlipCard({ slip, onReviewed }) {
  const { showToast } = useKip();
  const [busy, setBusy] = useState(null); // 'approve' | 'reject'
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const pending = slip.status === 'pending';

  async function review(approve) {
    setBusy(approve ? 'approve' : 'reject');
    try {
      await adminReviewSlip({ id: slip.id, approve, note: note.trim() });
      showToast(approve ? 'อนุมัติแล้ว — ผู้ใช้เป็น Pro ✓' : 'ปฏิเสธสลิปแล้ว');
      onReviewed();
    } catch (e) {
      showToast(`ทำรายการไม่สำเร็จ: ${e.message}`, 'error');
      setBusy(null);
    }
  }

  return (
    <li className="flex gap-3 py-3" data-testid="slip-row">
      <a href={slip.slip_url} target="_blank" rel="noreferrer" className="block h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-white/10" title="เปิดสลิปขนาดเต็ม">
        {slip.slip_url ? <img src={slip.slip_url} alt="สลิปการโอน" className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full items-center justify-center text-xs text-slate-400">ไม่มีรูป</span>}
      </a>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-bold tabular-nums">฿{Number(slip.amount).toLocaleString('th-TH')}</p>
        <p className="truncate text-sm font-medium">{slip.display_name || slip.email || '(ไม่ทราบชื่อ)'}</p>
        {slip.display_name && slip.email && <p className="truncate text-xs text-slate-500">{slip.email}</p>}
        <p className="mt-0.5 text-xs text-slate-500">
          {slip.billing_interval === 'month' ? 'รายเดือน' : 'รายปี'} · Tier {slip.tier} · {new Date(slip.created_at).toLocaleString('th-TH')}
        </p>
        {!pending && (
          <p className="mt-1 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${slip.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {slip.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}
            </span>
            {slip.review_note && <span className="ml-1.5 italic text-slate-500">📝 {slip.review_note}</span>}
          </p>
        )}
        {pending && rejecting && (
          <input className="input mt-2 py-1.5 text-sm" placeholder="เหตุผล (แสดงให้ผู้ใช้เห็น) เช่น ยอดไม่ตรง" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} autoFocus />
        )}
        {pending && (
          <div className="mt-2 flex gap-2">
            {rejecting ? (
              <>
                <button className="btn-outline flex-1 border-red-300 px-3 py-1.5 text-xs text-red-600" disabled={Boolean(busy)} onClick={() => review(false)}>
                  {busy === 'reject' ? <Spinner /> : 'ยืนยันปฏิเสธ'}
                </button>
                <button className="btn-ghost px-3 py-1.5 text-xs" disabled={Boolean(busy)} onClick={() => setRejecting(false)}>ยกเลิก</button>
              </>
            ) : (
              <>
                <button className="btn-primary flex-1 px-3 py-1.5 text-xs" disabled={Boolean(busy)} onClick={() => review(true)}>
                  {busy === 'approve' ? <Spinner className="border-white border-t-transparent" /> : '✓ อนุมัติ'}
                </button>
                <button className="btn-outline flex-1 px-3 py-1.5 text-xs text-red-600" disabled={Boolean(busy)} onClick={() => setRejecting(true)}>
                  ✕ ปฏิเสธ
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function SlipReview({ onChanged }) {
  const [filter, setFilter] = useState('pending');
  const [slips, setSlips] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async (status) => {
    setSlips(null);
    setError(null);
    try {
      setSlips(await adminListSlips(status));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [load, filter]);

  return (
    <>
      <div className="mb-3 flex gap-2" role="radiogroup" aria-label="สถานะสลิป">
        {SLIP_FILTERS.map(([s, label]) => (
          <button key={s} role="radio" aria-checked={filter === s} className={filter === s ? 'chip-on' : 'chip-off'} onClick={() => setFilter(s)}>
            {label}
          </button>
        ))}
      </div>
      <section className="card px-4">
        {error ? (
          <EmptyState icon="⚠️" title="โหลดสลิปไม่สำเร็จ">
            {error} <button className="btn-ghost px-2 text-xs" onClick={() => load(filter)}>ลองใหม่</button>
          </EmptyState>
        ) : slips === null ? (
          <Spinner full />
        ) : !slips.length ? (
          <EmptyState icon="🧾" title={filter === 'pending' ? 'ไม่มีสลิปรออนุมัติ' : 'ไม่มีรายการ'}>สลิปที่ผู้ใช้แนบจากหน้าอัปเกรดจะแสดงที่นี่</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {slips.map((s) => (
              <SlipCard
                key={s.id}
                slip={s}
                onReviewed={() => {
                  load(filter);
                  onChanged();
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('slips');
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null = not searched yet
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const loadStats = useCallback(() => {
    setStatsError(null);
    adminStats().then(setStats).catch((e) => setStatsError(e.message));
  }, []);

  const search = useCallback(async (q) => {
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await adminSearchUsers(q));
    } catch (e) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    search('');
  }, [loadStats, search]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link to="/settings" className="btn-ghost -ml-3 mb-2">← กลับ</Link>
      <h1 className="mb-4 text-2xl font-bold">หลังบ้าน</h1>

      {/* Stats */}
      {statsError ? (
        <div className="card mb-4 p-4 text-sm text-red-600">
          โหลดสถิติไม่สำเร็จ: {statsError} <button className="btn-ghost px-2 text-xs" onClick={loadStats}>ลองใหม่</button>
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="admin-stats">
          {stats ? (
            <>
              <StatCard label="ผู้ใช้ทั้งหมด" value={stats.total_users.toLocaleString('th-TH')} />
              <StatCard label="ผู้ใช้ Pro" value={stats.pro_users.toLocaleString('th-TH')} />
              <StatCard label="ยอดขายสะสม" value={`฿${Number(stats.revenue_thb).toLocaleString('th-TH')}`} />
              <StatCard label="Storage ที่ใช้" value={formatBytes(stats.storage_bytes)} />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-[76px] animate-pulse" />)
          )}
        </div>
      )}

      <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1 text-sm dark:bg-white/10" role="tablist">
        {[
          ['slips', '🧾 ตรวจสลิป'],
          ['users', '👤 ผู้ใช้'],
        ].map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 font-medium ${tab === t ? 'bg-white shadow dark:bg-white/20' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'slips' ? (
        <SlipReview
          onChanged={() => {
            loadStats();
            search(query);
          }}
        />
      ) : (
        <>
          {/* Search */}
          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              search(query);
            }}
          >
            <input className="input flex-1" type="search" placeholder="ค้นหาด้วย Email หรือ User ID" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="btn-primary" disabled={searching}>{searching ? <Spinner className="border-white border-t-transparent" /> : 'ค้นหา'}</button>
          </form>

          <section className="card px-4">
            {searchError ? (
              <EmptyState icon="⚠️" title="ค้นหาไม่สำเร็จ">{searchError}</EmptyState>
            ) : results === null ? (
              <Spinner full />
            ) : !results.length ? (
              <EmptyState icon="🔍" title="ไม่พบผู้ใช้">ลองค้นหาด้วยอีเมลบางส่วน หรือ User ID แบบเต็ม</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {results.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onChanged={() => {
                      search(query);
                      loadStats();
                    }}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
