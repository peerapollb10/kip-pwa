import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useKip } from '../context/KipContext.jsx';
import { GridCard } from '../components/ItemCard.jsx';
import ItemDetail from '../components/ItemDetail.jsx';
import SaveSheet from '../components/SaveSheet.jsx';
import SelectionBar from '../components/BulkActions.jsx';
import { EmptyState } from '../components/ui.jsx';
import { FREE_ITEM_LIMIT, showItemCount } from '../lib/pricing.js';
import { visibleItemTypes } from '../lib/content.js';

const isEditable = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

export default function Dashboard() {
  const { items, categories, loading, migrating, error, refresh, isGuest, isPro, patchItem, enabledTypes } = useKip();
  const [query, setQuery] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [types, setTypes] = useState([]); // multi-select; [] = all types
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | categoryId
  const [openId, setOpenId] = useState(null);
  const [composer, setComposer] = useState(null); // null = closed, {} = open
  const [dragging, setDragging] = useState(false);
  const q = useDeferredValue(query.trim().toLowerCase());

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  // A deleted category can't stay selected (its filter row may even be hidden).
  const activeCategory = catMap[categoryFilter] ? categoryFilter : 'all';

  const visible = useMemo(() => {
    return items.filter((i) => {
      if (favOnly && !i.is_favorite) return false;
      if (types.length && !types.includes(i.type)) return false;
      if (activeCategory !== 'all' && i.category_id !== activeCategory) return false;
      if (!q) return true;
      return [i.title, i.note, i.description, i.content_url, i.site_name, catMap[i.category_id]?.name]
        .some((f) => f && f.toLowerCase().includes(q));
    });
  }, [items, favOnly, types, activeCategory, q, catMap]);

  const toggleType = (t) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  // ── Multi-Select: null = off; long press a card to start. Deselecting the last item exits. ──
  const [selection, setSelection] = useState(null);
  const selecting = selection !== null;
  const selectedItems = useMemo(() => (selection ? items.filter((i) => selection.has(i.id)) : []), [items, selection]);
  const allVisibleSelected = selecting && visible.length > 0 && visible.every((i) => selection.has(i.id));
  const exitSelection = () => setSelection(null);
  const selectItem = (item) => setSelection((prev) => new Set(prev).add(item.id));
  const toggleSelect = (item) =>
    setSelection((prev) => {
      const next = new Set(prev);
      if (!next.delete(item.id)) next.add(item.id);
      return next.size ? next : null;
    });
  const toggleSelectAll = () => setSelection(allVisibleSelected ? null : new Set(visible.map((i) => i.id)));

  useEffect(() => {
    if (!selecting) return;
    const onKey = (e) => e.key === 'Escape' && !document.querySelector('[role="dialog"]') && setSelection(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selecting]);

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
      className={`min-h-screen ${selecting ? 'pb-40' : 'pb-28'}`}
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
            <input className="input pl-8" type="search" placeholder="ค้นหา" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Link
            to="/settings"
            aria-label="ตั้งค่า"
            title="ตั้งค่า"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition hover:bg-brand-100 active:scale-95 dark:bg-brand-500/15 dark:text-brand-100 dark:hover:bg-brand-500/25"
          >
            <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Link>
        </div>

        {/* Type filter (multi-select) + favourites */}
        <div className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-2" role="group" aria-label="กรองตามประเภท" data-testid="type-filter">
          <button
            className={!types.length && !favOnly ? 'chip-on' : 'chip-off'}
            aria-pressed={!types.length && !favOnly}
            onClick={() => {
              setTypes([]);
              setFavOnly(false);
            }}
          >
            ทั้งหมด
          </button>
          <button className={favOnly ? 'chip-on' : 'chip-off'} aria-pressed={favOnly} onClick={() => setFavOnly((v) => !v)}>
            ⭐ รายการโปรด
          </button>
          {visibleItemTypes(enabledTypes).map(([t, label]) => (
            <button key={t} className={types.includes(t) ? 'chip-on' : 'chip-off'} aria-pressed={types.includes(t)} onClick={() => toggleType(t)}>
              {types.includes(t) && '✓ '}
              {label}
            </button>
          ))}
        </div>

        {/* Category filter — only once the user has created a category */}
        {categories.length > 0 && (
          <div className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3" role="group" aria-label="กรองตามหมวดหมู่" data-testid="category-filter">
            {[['all', 'ทุกหมวดหมู่'], ...categories.map((c) => [c.id, `${c.emoji ?? ''} ${c.name}`])].map(([id, label]) => (
              <button key={id} className={activeCategory === id ? 'chip-on' : 'chip-off'} aria-pressed={activeCategory === id} onClick={() => setCategoryFilter(id)}>
                {label}
              </button>
            ))}
          </div>
        )}
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
        {!isPro && showItemCount(used) && (
          <Link to="/pricing" className="card mb-4 flex items-center gap-3 p-3 text-sm" data-testid="item-count-bar">
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
          <EmptyState icon="🔍" title="ไม่พบรายการ">ลองค้นหาด้วยคำอื่น หรือเปลี่ยนตัวกรองประเภท/หมวดหมู่</EmptyState>
        ) : (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
            {visible.map((item) => (
              <GridCard
                key={item.id}
                item={item}
                category={catMap[item.category_id]}
                onOpen={() => setOpenId(item.id)}
                onToggleFavorite={() => patchItem(item.id, { is_favorite: !item.is_favorite })}
                selecting={selecting}
                selected={selecting && selection.has(item.id)}
                onSelect={selectItem}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}
        {!selecting && visible.length > 0 && <p className="pb-2 pt-1 text-center text-xs text-slate-400">กดค้างที่การ์ดเพื่อเลือกหลายรายการ</p>}
      </main>

      {selecting ? (
        <SelectionBar selectedItems={selectedItems} allVisibleSelected={allVisibleSelected} onSelectAll={toggleSelectAll} onExit={exitSelection} />
      ) : (
      /* FAB */
      <button
        onClick={() => setComposer({})}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-3xl text-white shadow-lg shadow-brand-600/30 transition active:scale-95"
        aria-label="เพิ่มรายการใหม่"
      >
        +
      </button>
      )}

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
