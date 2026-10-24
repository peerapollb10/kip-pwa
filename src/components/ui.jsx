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

export function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-white/20'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

// Official brand marks (simplified) — recognisable at a glance, so they replace the text pill.
function YouTubeLogo({ className }) {
  return (
    <svg viewBox="0 0 28 20" className={className} aria-hidden>
      <path fill="#FF0000" d="M27.4 3.1A3.5 3.5 0 0 0 24.9.6C22.7 0 14 0 14 0S5.3 0 3.1.6A3.5 3.5 0 0 0 .6 3.1C0 5.3 0 10 0 10s0 4.7.6 6.9a3.5 3.5 0 0 0 2.5 2.5C5.3 20 14 20 14 20s8.7 0 10.9-.6a3.5 3.5 0 0 0 2.5-2.5C28 14.7 28 10 28 10s0-4.7-.6-6.9Z" />
      <path fill="#FFF" d="m11.2 14.3 7.3-4.3-7.3-4.3v8.6Z" />
    </svg>
  );
}

function FacebookLogo({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#0866FF" />
      <path fill="#FFF" d="M16.7 15.5 17.2 12h-3.4V9.8c0-1 .5-1.9 2-1.9h1.5V5s-1.4-.2-2.7-.2c-2.8 0-4.6 1.7-4.6 4.7V12H6.9v3.5H10V24h3.8v-8.5h2.9Z" />
    </svg>
  );
}

// [label, Logo, size on card overlay, size in detail header]
const BRAND_LOGOS = {
  youtube: ['YouTube', YouTubeLogo, 'h-[18px] w-[25px]', 'h-6 w-[34px]'],
  facebook: ['Facebook', FacebookLogo, 'h-[22px] w-[22px]', 'h-7 w-7'],
};

// `overlay`: pill with a white ring + soft shadow so it reads on any thumbnail, light or dark.
export function TypeBadge({ type, overlay = false }) {
  const brand = BRAND_LOGOS[type];
  if (brand) {
    const [label, Logo, overlaySize, size] = brand;
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={`inline-flex items-center justify-center ${overlay ? 'rounded-full bg-white p-1 shadow-md shadow-black/25' : ''}`}
      >
        <Logo className={overlay ? overlaySize : size} />
      </span>
    );
  }
  const map = {
    image: ['🖼', 'รูปภาพ', 'bg-emerald-500'],
    text: ['✎', 'โน้ต', 'bg-amber-500'],
    link: ['🔗', 'Web Link', 'bg-slate-500'],
    instagram: ['◎', 'Instagram', 'bg-pink-500'],
    tiktok: ['♪', 'TikTok', 'bg-slate-900'],
    document: ['📄', 'Document', 'bg-sky-600'],
  };
  const [icon, label, color] = map[type] || map.link;
  const shape = overlay
    ? 'h-[26px] rounded-full px-2.5 shadow-md shadow-black/25 ring-[1.5px] ring-white dark:ring-white/85'
    : 'rounded-md px-2 py-1';
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold leading-none text-white ${color} ${shape}`}>
      <span aria-hidden className="inline-flex min-w-3 justify-center">{icon}</span>
      {label}
    </span>
  );
}
