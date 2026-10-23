import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useKip } from '../context/KipContext.jsx';
import SaveSheet from '../components/SaveSheet.jsx';
import { Spinner } from '../components/ui.jsx';
import { draftFromShare } from '../lib/content.js';
import { fetchMetadata } from '../lib/api.js';

// Payload parked by the service worker (POST share target) or passed as query params
// (GET — used by the iOS Shortcut, since iOS has no Web Share Target support).
async function readSharedPayload(params) {
  if (params.get('source') === 'pwa' && 'caches' in window) {
    const cache = await caches.open('kip-share');
    const metaRes = await cache.match('/__shared/meta');
    const meta = metaRes ? await metaRes.json() : {};
    let file = null;
    if (meta.hasFile) {
      const fileRes = await cache.match('/__shared/file');
      if (fileRes) {
        const blob = await fileRes.blob();
        file = new File([blob], meta.fileName || 'shared-image', { type: blob.type });
      }
    }
    await Promise.all([cache.delete('/__shared/meta'), cache.delete('/__shared/file')]);
    return { title: meta.title, text: meta.text, url: meta.url, file };
  }
  return { title: params.get('title') || '', text: params.get('text') || '', url: params.get('url') || '', file: null };
}

export default function Share() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile, isPro, defaultCategory, saveItem, showToast } = useKip();
  const [payload, setPayload] = useState(null);
  const [quickSaving, setQuickSaving] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (!profile || handled.current) return;
    handled.current = true;

    (async () => {
      const shared = await readSharedPayload(params);
      if (!shared.file && !shared.text && !shared.url) return navigate('/', { replace: true });

      // Quick Mode (Pro only): skip the category sheet, save straight into 'ทั่วไป'.
      if (isPro && profile.quick_mode && defaultCategory) {
        setQuickSaving(true);
        try {
          const draft = shared.file
            ? { type: 'image', file: shared.file, title: shared.title, note: shared.text || null }
            : draftFromShare(shared);
          if (draft.url) Object.assign(draft, await fetchMetadata(draft.url), shared.title ? { title: shared.title } : {});
          await saveItem(draft, defaultCategory.id);
          showToast(`เซฟเข้า “${defaultCategory.name}” แล้ว ✓`);
        } catch (e) {
          if (e.code !== 'FREE_LIMIT_REACHED') showToast('เซฟไม่สำเร็จ', 'error');
        }
        return navigate('/', { replace: true });
      }
      setPayload(shared);
    })();
  }, [profile, isPro, defaultCategory, params, navigate, saveItem, showToast]);

  if (!payload || quickSaving) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <Spinner />
        {quickSaving ? `กำลังเซฟเข้า “${defaultCategory?.name ?? 'ทั่วไป'}”...` : 'กำลังเตรียมข้อมูล...'}
      </div>
    );
  }

  return <SaveSheet open initial={payload} onClose={() => navigate('/', { replace: true })} />;
}
