import { useEffect } from 'react';

export function Spinner({ full = false, className = '' }) {
  const el = (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent ${className}`}
      role="status"
      aria-label="กำลังโหลด"
    />
  );
  return full ? <div className="flex min-h-[60vh] items-center justify-center">{el}</div> : el;
}

// Bottom sheet on mobile, centered modal on ≥ sm.
export function Sheet({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full animate-sheet-up flex-col rounded-t-3xl bg-white shadow-xl dark:bg-[#16161d] sm:max-w-lg sm:rounded-3xl">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-white/20 sm:hidden" />
        {title && (
          <div className="flex items-center justify-between px-5 pb-2 pt-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <button className="btn-ghost -mr-2 px-2 py-1" onClick={onClose} aria-label="ปิด">✕</button>
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-slate-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/10">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = '🗂️', title, children }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-3 text-5xl">{icon}</div>
      <p className="font-semibold">{title}</p>
      <div className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{children}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/20'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

export function TypeBadge({ type }) {
  const map = {
    youtube: ['▶', 'YouTube', 'bg-red-500'],
    facebook: ['f', 'Facebook', 'bg-blue-600'],
    image: ['🖼', 'รูปภาพ', 'bg-emerald-500'],
    text: ['✎', 'โน้ต', 'bg-amber-500'],
    link: ['🔗', 'Web Link', 'bg-slate-500'],
    instagram: ['◎', 'Instagram', 'bg-pink-500'],
    tiktok: ['♪', 'TikTok', 'bg-slate-900'],
    document: ['📄', 'Document', 'bg-sky-600'],
  };
  const [icon, label, color] = map[type] || map.link;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white ${color}`}>
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}
