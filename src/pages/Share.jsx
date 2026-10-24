import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useKip } from '../context/KipContext.jsx';
import SaveSheet from '../components/SaveSheet.jsx';
import { Spinner } from '../components/ui.jsx';
import { composerFromShare } from '../lib/content.js';

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
  const { profile, canCreateItem } = useKip();
  const [payload, setPayload] = useState(null);
  const handled = useRef(false);

  useEffect(() => {
    if (!profile || handled.current) return;
    handled.current = true;

    (async () => {
      const shared = await readSharedPayload(params);
      if (!shared.file && !shared.text && !shared.url) return navigate('/', { replace: true });
      // Free plan at the limit: show the upgrade sheet on the dashboard instead of the save sheet.
      if (!canCreateItem()) return navigate('/', { replace: true });
      // Always open the composer pre-filled: the user reviews title / category / note and taps
      // save themselves — nothing is saved in the background.
      setPayload({ ...composerFromShare(shared), shared: true });
    })();
  }, [profile, canCreateItem, params, navigate]);

  if (!payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <Spinner />
        กำลังเตรียมข้อมูล...
      </div>
    );
  }

  return <SaveSheet open initial={payload} onClose={() => navigate('/', { replace: true })} />;
}
