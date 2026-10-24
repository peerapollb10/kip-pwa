import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useKip } from '../context/KipContext.jsx';
import { EmptyState, Sheet, TypeBadge } from '../components/ui.jsx';
import { thumbOf, titleOf } from '../components/ItemCard.jsx';
import { TRASH_RETENTION_DAYS, daysLeft } from '../lib/trash.js';

function TrashRow({ item, onRestore, onDelete, busy }) {
  const thumb = thumbOf(item);
  const left = daysLeft(item);
  return (
    <li className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-white/5" data-testid="trash-row">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-xl dark:bg-white/10">
        {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : item.type === 'text' ? '✎' : '🔗'}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium">{titleOf(item)}</h3>
        <div className="mt-1 flex items-center gap-2">
          <TypeBadge type={item.type} />
          <span className={`text-[11px] ${left <= 3 ? 'text-red-500' : 'text-slate-400'}`}>
            {left > 0 ? `ลบถาวรใน ${left} วัน` : 'จะถูกลบถาวรเร็ว ๆ นี้'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
        <button className="btn-outline px-3 py-1.5 text-xs" disabled={busy} onClick={() => onRestore(item)}>↩ คืนค่า</button>
        <button className="btn-ghost px-3 py-1.5 text-xs text-red-600 dark:text-red-400" disabled={busy} onClick={() => onDelete(item)}>ลบถาวร</button>
      </div>
    </li>
  );
}

export default function Trash() {
  const { trash, restoreItems, purgeItems, showToast } = useKip();
  const [confirm, setConfirm] = useState(null); // null | { items, label }
  const [busy, setBusy] = useState(false);

  async function run(fn, ok, fail) {
    setBusy(true);
    try {
      await fn();
      showToast(ok);
      return true;
    } catch (e) {
      if (e.code !== 'FREE_LIMIT_REACHED') showToast(fail, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const restore = (list) => run(() => restoreItems(list.map((i) => i.id)), `คืนค่า ${list.length} รายการแล้ว`, 'คืนค่าไม่สำเร็จ');

  async function purgeConfirmed() {
    const list = confirm.items;
    if (await run(() => purgeItems(list.map((i) => i.id)), `ลบถาวร ${list.length} รายการแล้ว`, 'ลบไม่สำเร็จ')) setConfirm(null);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link to="/settings" className="btn-ghost -ml-3 mb-2">← ตั้งค่า</Link>
      <div className="mb-4 flex items-center gap-2">
        <h1 className="flex-1 text-2xl font-bold">ถังขยะ</h1>
        {trash.length > 0 && (
          <>
            <button className="btn-outline px-3 py-1.5 text-xs" disabled={busy} onClick={() => restore(trash)}>คืนค่าทั้งหมด</button>
            <button className="btn-ghost px-3 py-1.5 text-xs text-red-600 dark:text-red-400" disabled={busy} onClick={() => setConfirm({ items: trash, label: `ทั้งหมด ${trash.length} รายการ` })}>
              ล้างถังขยะ
            </button>
          </>
        )}
      </div>

      <p className="mb-4 rounded-2xl bg-slate-100 px-3 py-2.5 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
        🗑 รายการที่ลบจะอยู่ในถังขยะ {TRASH_RETENTION_DAYS} วัน แล้วถูกลบถาวรโดยอัตโนมัติ
      </p>

      {trash.length ? (
        <ul className="card px-4" data-testid="trash-list">
          {trash.map((item) => (
            <TrashRow key={item.id} item={item} busy={busy} onRestore={(i) => restore([i])} onDelete={(i) => setConfirm({ items: [i], label: `"${titleOf(i)}"` })} />
          ))}
        </ul>
      ) : (
        <EmptyState icon="🗑️" title="ถังขยะว่างเปล่า">รายการที่คุณลบจะมาอยู่ที่นี่</EmptyState>
      )}

      <Sheet
        open={Boolean(confirm)}
        onClose={() => !busy && setConfirm(null)}
        title="ลบถาวร?"
        footer={
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" disabled={busy} onClick={() => setConfirm(null)}>ยกเลิก</button>
            <button className="btn flex-1 bg-red-600 text-white hover:bg-red-700" disabled={busy} onClick={purgeConfirmed}>ลบถาวร</button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ลบ <span className="font-medium">{confirm?.label}</span> ออกถาวร — กู้คืนไม่ได้อีก
        </p>
      </Sheet>
    </div>
  );
}
