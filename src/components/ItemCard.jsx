import { useRef } from 'react';
import { TypeBadge } from './ui.jsx';
import { hostnameOf } from '../lib/content.js';

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10; // px — more than this is a scroll, not a press

// Long press (touch/mouse) or right-click → onLongPress. `fired` lets onClick ignore the click that ends a press.
function useLongPress(onLongPress) {
  const timer = useRef(null);
  const origin = useRef(null);
  const fired = useRef(false);
  const cancel = () => {
    clearTimeout(timer.current);
    origin.current = null;
  };
  const fire = () => {
    fired.current = true;
    navigator.vibrate?.(15);
    onLongPress();
  };
  return {
    fired,
    handlers: {
      onPointerDown: (e) => {
        if (e.button !== 0) return;
        fired.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        clearTimeout(timer.current);
        timer.current = setTimeout(fire, LONG_PRESS_MS);
      },
      onPointerMove: (e) => {
        const o = origin.current;
        if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > MOVE_TOLERANCE) cancel();
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e) => {
        e.preventDefault(); // no browser menu / iOS callout over the card
        cancel();
        if (!fired.current) fire();
      },
    },
  };
}

function Star({ on, onClick }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded-full p-1.5 text-lg leading-none transition ${on ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300 dark:text-slate-600'}`}
      aria-label={on ? 'เอาออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
    >
      {on ? '★' : '☆'}
    </button>
  );
}

export const thumbOf = (item) => item.image_url || item.thumbnail_url;
export const titleOf = (item) => item.title || item.note?.split('\n')[0] || hostnameOf(item.content_url) || 'ไม่มีชื่อ';

// Multi-Select: long press enters select mode (onSelect); while `selecting`, a tap toggles instead of opening.
export function GridCard({ item, category, onOpen, onToggleFavorite, selecting = false, selected = false, onSelect, onToggleSelect }) {
  const thumb = thumbOf(item);
  const { fired, handlers } = useLongPress(() => onSelect?.(item));

  function handleClick() {
    if (fired.current) {
      fired.current = false;
      return;
    }
    if (selecting) onToggleSelect?.(item);
    else onOpen(item);
  }

  return (
    <article
      {...handlers}
      onClick={handleClick}
      aria-selected={selecting ? selected : undefined}
      data-testid="item-card"
      className={`card relative mb-3 cursor-pointer select-none break-inside-avoid overflow-hidden transition [-webkit-touch-callout:none] hover:shadow-md ${
        selected ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-slate-50 dark:ring-offset-[#0b0b0f]' : ''
      } ${selecting && !selected ? 'opacity-80' : ''}`}
    >
      <span className="pointer-events-none absolute left-2.5 top-2.5 z-10 flex">
        <TypeBadge type={item.type} overlay />
      </span>
      {selecting && (
        <span
          aria-hidden
          className={`pointer-events-none absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md shadow-black/25 transition ${
            selected ? 'bg-brand-600' : 'bg-black/25'
          }`}
        >
          {selected && '✓'}
        </span>
      )}
      {selected && <span className="pointer-events-none absolute inset-0 z-[5] bg-brand-500/10" />}
      {thumb && (
        <div className="relative">
          <img src={thumb} alt="" loading="lazy" draggable={false} className="w-full object-cover" />
          {item.type === 'youtube' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white">▶</span>
            </span>
          )}
        </div>
      )}
      <div className={`p-3 ${thumb ? '' : 'pt-10'}`}>
        <div className="flex items-start gap-1">
          <h3 className="line-clamp-3 min-w-0 flex-1 text-sm font-medium leading-snug">{titleOf(item)}</h3>
          <span className={`-mr-1.5 -mt-1.5 shrink-0 ${selecting ? 'pointer-events-none' : ''}`}>
            <Star on={item.is_favorite} onClick={onToggleFavorite} />
          </span>
        </div>
        {item.type === 'text' && item.note && item.note !== titleOf(item) && (
          <p className="mt-1 line-clamp-4 whitespace-pre-line text-xs text-slate-500 dark:text-slate-400">{item.note}</p>
        )}
        {category && <p className="mt-2 truncate text-xs text-slate-400">{`${category.emoji ?? ''} ${category.name}`.trim()}</p>}
      </div>
    </article>
  );
}

export function ListRow({ item, category, onOpen, onToggleFavorite }) {
  const thumb = thumbOf(item);
  return (
    <article onClick={() => onOpen(item)} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-1 py-3 last:border-0 dark:border-white/5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-xl dark:bg-white/10">
        {thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : item.type === 'text' ? '✎' : '🔗'}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium">{titleOf(item)}</h3>
        {category && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{category.name}</p>}
      </div>
      <Star on={item.is_favorite} onClick={onToggleFavorite} />
    </article>
  );
}
