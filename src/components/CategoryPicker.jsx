import { useState } from 'react';
import { useKip } from '../context/KipContext.jsx';

// Single-select category chips (tap the selected chip again → no category = null)
// plus a "+" chip that creates a new category inline and selects it.
export default function CategoryPicker({ value, onChange }) {
  const { categories, addCategory, showToast } = useKip();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📁');
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const c = await addCategory(name.trim(), emoji || null);
      onChange(c.id);
      setName('');
      setEmoji('📁');
      setAdding(false);
    } catch {
      showToast('เพิ่มหมวดหมู่ไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button key={c.id} type="button" className={value === c.id ? 'chip-on' : 'chip-off'} onClick={() => onChange(value === c.id ? null : c.id)}>
            {c.emoji} {c.name}
          </button>
        ))}
        {!adding && (
          <button type="button" className="chip-off border-dashed" onClick={() => setAdding(true)} aria-label="สร้างหมวดหมู่ใหม่" title="สร้างหมวดหมู่ใหม่">
            ＋{!categories.length && ' สร้างหมวดหมู่'}
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-2 flex gap-2">
          <input className="input w-14 text-center" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} aria-label="อีโมจิ" />
          <input
            className="input flex-1"
            placeholder="ชื่อหมวดหมู่ใหม่"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create();
              if (e.key === 'Escape') {
                e.stopPropagation();
                setAdding(false);
              }
            }}
            maxLength={40}
            autoFocus
          />
          <button type="button" className="btn-primary px-3" disabled={!name.trim() || busy} onClick={create}>เพิ่ม</button>
          <button type="button" className="btn-ghost px-2" onClick={() => setAdding(false)} aria-label="ยกเลิก">✕</button>
        </div>
      )}
      {value === null && categories.length > 0 && <p className="mt-1.5 text-xs text-slate-400">ไม่เลือกหมวดหมู่ก็ได้</p>}
    </div>
  );
}
