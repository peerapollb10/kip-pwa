import { useEffect, useMemo, useState } from 'react';
import { Sheet, Spinner, TypeBadge } from './ui.jsx';
import { useKip } from '../context/KipContext.jsx';
import { fetchMetadata } from '../lib/api.js';
import { draftFromShare, hostnameOf } from '../lib/content.js';
import { FREE_ITEM_LIMIT } from '../lib/pricing.js';

// Bottom sheet for saving: pick a category at save time.
// `initial` may contain {title, text, url, file}; if empty, it acts as a composer.
export default function SaveSheet({ open, initial, onClose, onSaved }) {
  const { categories, saveItem, isPro, items, showToast } = useKip();
  const [raw, setRaw] = useState('');
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const text = [initial?.text, initial?.url].filter(Boolean).join(' ').trim();
    setRaw(text);
    setFile(initial?.file || null);
    setTitle(initial?.title || '');
    setNote('');
    setMeta(null);
    setCategoryId(null);
  }, [open, initial]);

  const draft = useMemo(() => {
    if (file) return { type: 'image', url: null, note: raw.trim() || null };
    return draftFromShare({ text: raw });
  }, [raw, file]);

  // Debounced metadata lookup for URLs
  useEffect(() => {
    if (!open || !draft.url) {
      setMeta(null);
      setMetaLoading(false);
      return;
    }
    let cancelled = false;
    setMetaLoading(true);
    const t = setTimeout(async () => {
      const m = await fetchMetadata(draft.url);
      if (!cancelled) {
        setMeta(m);
        setMetaLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, draft.url]);

  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => filePreview && URL.revokeObjectURL(filePreview), [filePreview]);

  const canSave = Boolean(file || draft.url || draft.note);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...draft,
        file,
        title: title.trim() || meta?.title || null,
        description: meta?.description,
        thumbnail_url: meta?.thumbnail_url,
        site_name: meta?.site_name || (draft.url ? hostnameOf(draft.url) : null),
        note: [draft.note, note.trim()].filter(Boolean).join('\n') || null,
      };
      const item = await saveItem(payload, categoryId);
      showToast('เซฟแล้ว ✓');
      onSaved?.(item);
      onClose();
    } catch (e) {
      if (e.code === 'QUOTA_EXCEEDED') showToast('พื้นที่ในเครื่องเต็ม — เข้าสู่ระบบด้วย Gmail/LINE เพื่อเก็บบนคลาวด์', 'error');
      else if (e.code !== 'FREE_LIMIT_REACHED') showToast('เซฟไม่สำเร็จ ลองใหม่อีกครั้ง', 'error');
    } finally {
      setSaving(false);
    }
  }

  const remaining = FREE_ITEM_LIMIT - items.length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="เซฟเข้า Kip"
      footer={
        <div className="flex items-center gap-3">
          {!isPro && (
            <span className="text-xs text-slate-500">
              เหลือ {Math.max(0, remaining)}/{FREE_ITEM_LIMIT} รายการ
            </span>
          )}
          <button className="btn-primary ml-auto min-w-28" disabled={!canSave || saving} onClick={handleSave}>
            {saving ? <Spinner className="border-white border-t-transparent" /> : 'เซฟ'}
          </button>
        </div>
      }
    >
      {/* Input */}
      {file ? (
        <div className="relative mb-3 overflow-hidden rounded-2xl">
          <img src={filePreview} alt="" className="max-h-64 w-full object-cover" />
          <button className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white" onClick={() => setFile(null)}>
            ลบรูป
          </button>
        </div>
      ) : (
        <div className="mb-3">
          <textarea
            className="input min-h-[84px] resize-none"
            placeholder="วางลิงก์ หรือพิมพ์โน้ต..."
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            autoFocus={!initial?.text && !initial?.url}
          />
          <label className="btn-ghost mt-1 cursor-pointer px-2 py-1 text-xs">
            🖼 แนบรูปภาพ
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
          </label>
        </div>
      )}

      {/* Preview */}
      {draft.url && (
        <div className="card mb-3 flex gap-3 p-2.5">
          <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-white/10">
            {metaLoading ? (
              <div className="h-full w-full animate-pulse" />
            ) : (
              meta?.thumbnail_url && <img src={meta.thumbnail_url} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <TypeBadge type={draft.type} />
            <p className="mt-1 line-clamp-2 text-sm font-medium">{metaLoading ? 'กำลังดึงข้อมูล...' : meta?.title || hostnameOf(draft.url)}</p>
            <p className="truncate text-xs text-slate-500">{hostnameOf(draft.url)}</p>
          </div>
        </div>
      )}

      {(draft.url || file) && (
        <input className="input mb-2" placeholder="ชื่อเรื่อง (ไม่บังคับ)" value={title} onChange={(e) => setTitle(e.target.value)} />
      )}
      {(draft.url || file) && (
        <textarea className="input mb-3 min-h-[60px] resize-none" placeholder="เพิ่มโน้ต (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} />
      )}

      {/* Category picker */}
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">เลือกหมวดหมู่</p>
      <div className="flex flex-wrap gap-2">
        <button className={categoryId === null ? 'chip-on' : 'chip-off'} onClick={() => setCategoryId(null)}>
          📥 Inbox
        </button>
        {categories.map((c) => (
          <button key={c.id} className={categoryId === c.id ? 'chip-on' : 'chip-off'} onClick={() => setCategoryId(c.id)}>
            {c.emoji} {c.name}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
