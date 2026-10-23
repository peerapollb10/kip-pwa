import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useKip } from '../context/KipContext.jsx';
import { GridCard, ListRow } from '../components/ItemCard.jsx';
import ItemDetail from '../components/ItemDetail.jsx';
import SaveSheet from '../components/SaveSheet.jsx';
import { EmptyState } from '../components/ui.jsx';
import { FREE_ITEM_LIMIT } from '../lib/pricing.js';

const isEditable = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

export default function Dashboard() {
  const { items, categories, profile, loading, migrating, error, refresh, isGuest, isPro, patchItem, saveProfile } = useKip();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'fav' | 'inbox' | categoryId
  const [openId, setOpenId] = useState(null);
  const [composer, setComposer] = useState(null); // null = closed, {} = open
  const [dragging, setDragging] = useState(false);
  const view = profile?.view_mode || 'grid';
  const q = useDeferredValue(query.trim().toLowerCase());

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const visible = useMemo(() => {
    return items.filter((i) => {
      if (filter === 'fav' && !i.is_favorite) return false;
      if (filter === 'inbox' && i.category_id) return false;
      if (filter !== 'all' && filter !== 'fav' && filter !== 'inbox' && i.category_id !== filter) return false;
      if (!q) return true;
      return [i.title, i.note, i.description, i.content_url, i.site_name, catMap[i.category_id]?.name]
        .some((f) => f && f.toLowerCase().includes(q));
    });
  }, [items, filter, q, catMap]);

  // Desktop: paste anywhere (outside inputs) → open save sheet
  useEffect(() => {
    function onPaste(e) {
      if (isEditable(document.activeElement) || composer) return;
      const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
      const text = e.clipboardData?.getData('text') || '';
      if (file || text) {
        e.preventDefault();
        setComposer({ text, file });
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [composer]);

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = [...(e.dataTransfer.files || [])].find((f) => f.type.startsWith('image/'));
    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (file || text) setComposer({ text, file });
  }

  const openItem = items.find((i) => i.id === openId) || null;
  const used = items.length;

  return (
    <div
      className="min-h-screen pb-28"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setDragging(false)}
      onDrop={onDrop}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-slate-50/85 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-white/5 dark:bg-[#0b0b0f]/85">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-1.5 text-lg font-bold">
            <img src="/icons/icon.svg" alt="" className="h-7 w-7" /> Kip
          </Link>
          <div className="relative ml-2 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            <input className="input pl-8" type="search" placeholder="ค้นหาลิงก์ โน้ต รูป..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex rounded-xl bg-slate-200/60 p-0.5 dark:bg-white/10" role="group" aria-label="มุมมอง">
            {[['grid', '▦', 'Masonry'], ['list', '☰', 'List']].map(([v, icon, label]) => (
              <button
                key={v}
                aria-label={label}
                aria-pressed={view === v}
                onClick={() => saveProfile({ view_mode: v }).catch(() => {})}
                className={`rounded-lg px-2.5 py-1.5 text-sm ${view === v ? 'bg-white shadow dark:bg-white/20' : 'text-slate-500'}`}
              >
                {icon}
              </button>
            ))}
          </div>
          <Link to="/settings" className="btn-ghost px-2.5" aria-label="ตั้งค่า">⚙︎</Link>
        </div>

        {/* Category filter */}
        <div className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3">
          {[
            ['all', 'ทั้งหมด'],
            ['fav', '⭐ รายการโปรด'],
            ['inbox', '📥 Inbox'],
            ...categories.map((c) => [c.id, `${c.emoji ?? ''} ${c.name}`]),
          ].map(([id, label]) => (
            <button key={id} className={filter === id ? 'chip-on' : 'chip-off'} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-4">
        {isGuest && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200" data-testid="guest-banner">
            <span className="flex-1">👤 โหมด Guest — ข้อมูลอยู่ในเครื่องนี้เท่านั้น</span>
            <Link to="/login" className="shrink-0 font-semibold underline underline-offset-2">เชื่อมต่อบัญชี</Link>
          </div>
        )}
        {migrating && (
          <div className="mb-3 rounded-2xl bg-brand-50 px-3 py-2.5 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-100">กำลังย้ายข้อมูลจากโหมด Guest ขึ้นบัญชี...</div>
        )}
        {!isPro && (
          <Link to="/pricing" className="card mb-4 flex items-center gap-3 p-3 text-sm">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>แพ็กเกจฟรี</span>
                <span>{used}/{FREE_ITEM_LIMIT} รายการ</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div className={`h-full rounded-full ${used >= FREE_ITEM_LIMIT ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, (used / FREE_ITEM_LIMIT) * 100)}%` }} />
              </div>
            </div>
            <span className="font-semibold text-brand-600">อัปเกรด →</span>
          </Link>
        )}

        {loading && !items.length ? (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card mb-3 animate-pulse break-inside-avoid" style={{ height: 120 + ((i * 47) % 120) }} />
            ))}
          </div>
        ) : error ? (
          <EmptyState icon="⚠️" title="โหลดข้อมูลไม่สำเร็จ">
            <p>{error}</p>
            <button className="btn-primary mt-4" onClick={refresh}>ลองใหม่</button>
          </EmptyState>
        ) : !items.length ? (
          <EmptyState icon="✨" title="ยังไม่มีอะไรใน Kip">
            กดแชร์จากแอปอื่นมาที่ Kip, กดปุ่ม + ด้านล่าง หรือบนคอมพิวเตอร์ลองกด Ctrl/⌘ + V หรือลากลิงก์มาวางได้เลย
          </EmptyState>
        ) : !visible.length ? (
          <EmptyState icon="🔍" title="ไม่พบรายการ">ลองค้นหาด้วยคำอื่น หรือเปลี่ยนหมวดหมู่</EmptyState>
        ) : view === 'grid' ? (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
            {visible.map((item) => (
              <GridCard key={item.id} item={item} category={catMap[item.category_id]} onOpen={() => setOpenId(item.id)} onToggleFavorite={() => patchItem(item.id, { is_favorite: !item.is_favorite })} />
            ))}
          </div>
        ) : (
          <div className="card px-3">
            {visible.map((item) => (
              <ListRow key={item.id} item={item} category={catMap[item.category_id]} onOpen={() => setOpenId(item.id)} onToggleFavorite={() => patchItem(item.id, { is_favorite: !item.is_favorite })} />
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setComposer({})}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-3xl text-white shadow-lg shadow-brand-600/30 transition active:scale-95"
        aria-label="เพิ่มรายการใหม่"
      >
        +
      </button>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-brand-600/10 backdrop-blur-sm">
          <div className="rounded-3xl border-2 border-dashed border-brand-500 bg-white/90 px-10 py-8 text-center font-semibold text-brand-700 dark:bg-black/70 dark:text-brand-100">
            วางลิงก์หรือรูปภาพที่นี่เพื่อเซฟ
          </div>
        </div>
      )}

      <SaveSheet open={Boolean(composer)} initial={composer} onClose={() => setComposer(null)} />
      <ItemDetail item={openItem} onClose={() => setOpenId(null)} />
    </div>
  );
}
