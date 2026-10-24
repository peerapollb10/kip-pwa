import { TypeBadge } from './ui.jsx';
import { hostnameOf } from '../lib/content.js';

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

const thumbOf = (item) => item.image_url || item.thumbnail_url;
const titleOf = (item) => item.title || item.note?.split('\n')[0] || hostnameOf(item.content_url) || 'ไม่มีชื่อ';

export function GridCard({ item, category, onOpen, onToggleFavorite }) {
  const thumb = thumbOf(item);
  return (
    <article onClick={() => onOpen(item)} className="card relative mb-3 cursor-pointer break-inside-avoid overflow-hidden transition hover:shadow-md">
      <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-md shadow-md ring-1 ring-white/70 dark:ring-black/30">
        <TypeBadge type={item.type} />
      </span>
      {thumb && (
        <div className="relative">
          <img src={thumb} alt="" loading="lazy" className="w-full object-cover" />
          {item.type === 'youtube' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white">▶</span>
            </span>
          )}
        </div>
      )}
      <div className={`p-3 ${thumb ? '' : 'pt-9'}`}>
        <div className="flex items-start gap-1">
          <h3 className="line-clamp-3 min-w-0 flex-1 text-sm font-medium leading-snug">{titleOf(item)}</h3>
          <span className="-mr-1.5 -mt-1.5 shrink-0">
            <Star on={item.is_favorite} onClick={onToggleFavorite} />
          </span>
        </div>
        {item.type === 'text' && item.note && item.note !== titleOf(item) && (
          <p className="mt-1 line-clamp-4 whitespace-pre-line text-xs text-slate-500 dark:text-slate-400">{item.note}</p>
        )}
        {category && <p className="mt-2 truncate text-[11px] text-slate-400">{`${category.emoji ?? ''} ${category.name}`.trim()}</p>}
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
