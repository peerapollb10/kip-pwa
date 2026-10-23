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
    <article onClick={() => onOpen(item)} className="card mb-3 cursor-pointer break-inside-avoid overflow-hidden transition hover:shadow-md">
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
      <div className="p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <TypeBadge type={item.type} />
          <Star on={item.is_favorite} onClick={onToggleFavorite} />
        </div>
        <h3 className="line-clamp-3 text-sm font-medium leading-snug">{titleOf(item)}</h3>
        {item.type === 'text' && item.note && item.note !== titleOf(item) && (
          <p className="mt-1 line-clamp-4 whitespace-pre-line text-xs text-slate-500 dark:text-slate-400">{item.note}</p>
        )}
        <p className="mt-2 truncate text-[11px] text-slate-400">
          {category ? `${category.emoji ?? ''} ${category.name}` : '📥 Inbox'}
          {item.content_url && ` · ${hostnameOf(item.content_url)}`}
        </p>
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
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {category ? category.name : 'Inbox'}
          {item.content_url && ` · ${hostnameOf(item.content_url)}`}
        </p>
      </div>
      <Star on={item.is_favorite} onClick={onToggleFavorite} />
    </article>
  );
}
