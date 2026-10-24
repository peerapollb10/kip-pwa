import { useEffect, useState } from 'react';
import { Sheet } from './ui.jsx';
import CategoryPicker from './CategoryPicker.jsx';
import { useKip } from '../context/KipContext.jsx';
import { visibleItemTypes } from '../lib/content.js';
import { titleOf } from './ItemCard.jsx';

function ActionButton({ icon, label, onClick, danger, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs font-medium transition active:scale-95 disabled:opacity-40 ${
        danger ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10'
      }`}
    >
      <span className="text-lg leading-none" aria-hidden>{icon}</span>
      {label}
    </button>
  );
}

async function shareItems(items, showToast) {
  const text = items.map((i) => [titleOf(i), i.content_url].filter(Boolean).join('\n')).join('\n\n');
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Kip', text });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false; // user closed the share sheet
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast(`คัดลอก ${items.length} รายการแล้ว`);
    return true;
  } catch {
    showToast('แชร์ไม่สำเร็จ', 'error');
    return false;
  }
}

// Category / type for every selected item. "ไม่เปลี่ยน" leaves that field as is.
function BulkEditSheet({ open, items, onClose, onDone }) {
  const { patchItems, enabledTypes, showToast } = useKip();
  const [categoryId, setCategoryId] = useState(undefined); // undefined = keep, null = none
  const [type, setType] = useState(null); // null = keep
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategoryId(undefined);
    setType(null);
  }, [open]);

  const patch = { ...(categoryId !== undefined && { category_id: categoryId }), ...(type && { type }) };
  const dirty = Object.keys(patch).length > 0;

  async function apply() {
    setBusy(true);
    try {
      await patchItems(items.map((i) => i.id), patch);
      showToast(`อัปเดต ${items.length} รายการแล้ว`);
      onDone();
    } catch {
      showToast('บันทึกไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`ระบุประเภท · ${items.length} รายการ`}
      footer={
        <button className="btn-primary w-full" disabled={!dirty || busy} onClick={apply}>
          บันทึก
        </button>
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">หมวดหมู่</span>
        <div className="flex gap-1.5">
          <button type="button" className={categoryId === null ? 'chip-on py-1 text-xs' : 'chip-off py-1 text-xs'} onClick={() => setCategoryId(null)}>
            ไม่มีหมวดหมู่
          </button>
          <button type="button" className={categoryId === undefined ? 'chip-on py-1 text-xs' : 'chip-off py-1 text-xs'} onClick={() => setCategoryId(undefined)}>
            ไม่เปลี่ยน
          </button>
        </div>
      </div>
      {/* value undefined = "keep": no chip highlighted; tapping the selected chip again → null (no category) */}
      <CategoryPicker value={categoryId} onChange={setCategoryId} />

      <div className="mb-2 mt-5 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">ประเภท</span>
        <button type="button" className={!type ? 'chip-on py-1 text-xs' : 'chip-off py-1 text-xs'} onClick={() => setType(null)}>
          ไม่เปลี่ยน
        </button>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="ประเภท">
        {visibleItemTypes(enabledTypes).map(([t, label]) => (
          <button key={t} type="button" role="radio" aria-checked={type === t} className={type === t ? 'chip-on' : 'chip-off'} onClick={() => setType(type === t ? null : t)}>
            {label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

// Bottom action bar for Multi-Select: แชร์ / ระบุประเภท / ลบ (→ ถังขยะ).
export default function SelectionBar({ selectedItems, allVisibleSelected, onSelectAll, onExit }) {
  const { trashItems, showToast } = useKip();
  const [editOpen, setEditOpen] = useState(false);
  const count = selectedItems.length;

  async function handleTrash() {
    try {
      await trashItems(selectedItems.map((i) => i.id));
      showToast(`ย้าย ${count} รายการไปถังขยะแล้ว`);
      onExit();
    } catch {
      showToast('ลบไม่สำเร็จ', 'error');
    }
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 animate-sheet-up px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" data-testid="selection-bar">
        <div className="mx-auto max-w-lg rounded-3xl border border-slate-200/70 bg-white/95 p-2 shadow-xl shadow-black/10 backdrop-blur dark:border-white/10 dark:bg-[#16161d]/95">
          <div className="flex items-center gap-2 px-2 pb-1 pt-0.5">
            <button type="button" className="btn-ghost -ml-1 px-2 py-1" onClick={onExit} aria-label="ยกเลิกการเลือก">✕</button>
            <span className="flex-1 text-sm font-semibold">เลือกแล้ว {count} รายการ</span>
            <button type="button" className="btn-ghost px-2 py-1 text-xs text-brand-600 dark:text-brand-100" onClick={onSelectAll}>
              {allVisibleSelected ? 'ไม่เลือกทั้งหมด' : 'เลือกทั้งหมด'}
            </button>
          </div>
          <div className="flex gap-1 border-t border-slate-100 pt-1 dark:border-white/10">
            <ActionButton icon="↗" label="แชร์" disabled={!count} onClick={() => shareItems(selectedItems, showToast)} />
            <ActionButton icon="🏷" label="ระบุประเภท" disabled={!count} onClick={() => setEditOpen(true)} />
            <ActionButton icon="🗑" label="ลบ" danger disabled={!count} onClick={handleTrash} />
          </div>
        </div>
      </div>
      <BulkEditSheet
        open={editOpen}
        items={selectedItems}
        onClose={() => setEditOpen(false)}
        onDone={() => {
          setEditOpen(false);
          onExit();
        }}
      />
    </>
  );
}
