import { useEffect, useState } from 'react';
import { Sheet, TypeBadge } from './ui.jsx';
import { useKip } from '../context/KipContext.jsx';
import { getYouTubeId, hostnameOf } from '../lib/content.js';
import CategoryPicker from './CategoryPicker.jsx';

const OPEN_IN = {
  youtube: 'เปิดใน YouTube',
  facebook: 'เปิดใน Facebook',
  instagram: 'เปิดใน Instagram',
  tiktok: 'เปิดใน TikTok',
  document: 'เปิดเอกสาร',
};

// Hybrid view: preview inside Kip + button to open the original app/site.
export default function ItemDetail({ item, onClose }) {
  const { patchItem, trashItems, showToast } = useKip();
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setNote(item?.note || '');
    setTitle(item?.title || '');
    setEditingTitle(false);
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item) return null;
  const ytId = item.type === 'youtube' ? getYouTubeId(item.content_url) : null;

  async function handleDelete() {
    try {
      await trashItems([item.id]);
      showToast('ย้ายไปถังขยะแล้ว · กู้คืนได้ใน 30 วัน');
      onClose();
    } catch {
      showToast('ลบไม่สำเร็จ', 'error');
    }
  }

  function saveNote() {
    if ((item.note || '') !== note) patchItem(item.id, { note: note || null });
  }

  function saveTitle() {
    const next = title.trim();
    if ((item.title || '') !== next) patchItem(item.id, { title: next || null });
    setTitle(next);
    setEditingTitle(false);
  }

  function cancelTitle() {
    setTitle(item.title || '');
    setEditingTitle(false);
  }

  return (
    <Sheet
      open={Boolean(item)}
      onClose={() => {
        saveNote();
        if (editingTitle) saveTitle();
        onClose();
      }}
      title={<TypeBadge type={item.type} />}
      footer={
        <div className="flex items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-sm text-red-600">ย้ายไปถังขยะ?</span>
              <button className="btn-ghost ml-auto" onClick={() => setConfirmDelete(false)}>ยกเลิก</button>
              <button className="btn bg-red-600 text-white" onClick={handleDelete}>ย้ายไปถังขยะ</button>
            </>
          ) : (
            <>
              <button className="btn-ghost text-red-600" onClick={() => setConfirmDelete(true)}>🗑 ลบ</button>
              {item.content_url && (
                <a href={item.content_url} target="_blank" rel="noopener noreferrer" className="btn-primary ml-auto">
                  {OPEN_IN[item.type] || 'เปิดในเว็บไซต์'} ↗
                </a>
              )}
            </>
          )}
        </div>
      }
    >
      {ytId ? (
        <div className="mb-3 aspect-video overflow-hidden rounded-2xl bg-black">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${ytId}`}
            title={item.title || 'YouTube'}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        (item.image_url || item.thumbnail_url) && (
          <img src={item.image_url || item.thumbnail_url} alt="" className="mb-3 max-h-[50vh] w-full rounded-2xl object-contain" />
        )
      )}

      {editingTitle ? (
        <div className="flex items-center gap-2">
          <input
            className="input flex-1"
            value={title}
            autoFocus
            placeholder="ชื่อเรื่อง"
            aria-label="ชื่อเรื่อง"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle();
              if (e.key === 'Escape') {
                e.stopPropagation();
                cancelTitle();
              }
            }}
          />
          <button type="button" className="btn-ghost" onClick={cancelTitle}>ยกเลิก</button>
          <button type="button" className="btn-primary" onClick={saveTitle}>บันทึก</button>
        </div>
      ) : item.title ? (
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-lg font-semibold leading-snug">{item.title}</h2>
          <button type="button" className="btn-ghost shrink-0 px-2 py-1 text-sm" onClick={() => setEditingTitle(true)} aria-label="แก้ไขชื่อเรื่อง" title="แก้ไขชื่อเรื่อง">✏️</button>
        </div>
      ) : (
        <button type="button" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" onClick={() => setEditingTitle(true)}>✏️ เพิ่มชื่อเรื่อง</button>
      )}
      {item.content_url && <p className="mt-0.5 truncate text-xs text-slate-500">{item.site_name || hostnameOf(item.content_url)}</p>}
      {item.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>}

      <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500">โน้ต</label>
      <textarea className="input mt-1 min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} placeholder="จดอะไรไว้หน่อย..." />

      <label className="mb-2 mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500">หมวดหมู่</label>
      <CategoryPicker value={item.category_id ?? null} onChange={(id) => patchItem(item.id, { category_id: id })} />
      <p className="mt-4 text-xs text-slate-400">เซฟเมื่อ {new Date(item.created_at).toLocaleString('th-TH')}</p>
    </Sheet>
  );
}
