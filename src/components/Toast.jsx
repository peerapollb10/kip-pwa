import { useEffect } from 'react';
import { useKip } from '../context/KipContext.jsx';

export default function Toast() {
  const { toast, showToast } = useKip();

  useEffect(() => {
    if (!toast?.message) return;
    const t = setTimeout(() => showToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast, showToast]);

  if (!toast?.message) return null;
  const tone = toast.tone === 'error' ? 'bg-red-600' : 'bg-slate-900 dark:bg-white dark:text-slate-900';
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4" aria-live="polite">
      <div className={`animate-fade-in rounded-full px-4 py-2 text-sm text-white shadow-lg ${tone}`}>{toast.message}</div>
    </div>
  );
}
