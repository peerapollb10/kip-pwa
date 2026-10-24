// Content-type detection for shared/pasted input.

const URL_RE = /https?:\/\/[^\s<>"']+/i;

export function extractUrl(text = '') {
  const match = String(text).match(URL_RE);
  return match ? match[0].replace(/[).,!?]+$/, '') : null;
}

export function getYouTubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export function isFacebookUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^(www\.|m\.|web\.)/, '');
    return ['facebook.com', 'fb.watch', 'fb.com', 'fb.me'].includes(host);
  } catch {
    return false;
  }
}

function hostIn(url, hosts) {
  try {
    const host = new URL(url).hostname.replace(/^(www\.|m\.|vm\.|vt\.)/, '');
    return hosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export const isInstagramUrl = (url) => hostIn(url, ['instagram.com', 'instagr.am']);
export const isTikTokUrl = (url) => hostIn(url, ['tiktok.com']);

const DOC_EXT_RE = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|rtf|odt|ods|odp|pages|numbers|key)$/i;
export function isDocumentUrl(url) {
  try {
    const u = new URL(url);
    if (DOC_EXT_RE.test(u.pathname)) return true;
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'docs.google.com') return true;
    if (host === 'drive.google.com' && u.pathname.startsWith('/file/')) return true;
  } catch {
    /* not a URL */
  }
  return false;
}

export function detectType({ url, file } = {}) {
  if (file) return 'image';
  if (!url) return 'text';
  if (getYouTubeId(url)) return 'youtube';
  if (isFacebookUrl(url)) return 'facebook';
  if (isInstagramUrl(url)) return 'instagram';
  if (isTikTokUrl(url)) return 'tiktok';
  if (isDocumentUrl(url)) return 'document';
  return 'link';
}

// Order shown in the Dashboard type filter.
export const ITEM_TYPES = [
  ['facebook', 'Facebook'],
  ['text', 'โน้ต'],
  ['image', 'รูปภาพ'],
  ['youtube', 'YouTube'],
  ['link', 'Web Link'],
  ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'],
  ['document', 'Document'],
];

// Normalise Web Share Target params ({title, text, url}) into a draft item.
// Many Android apps put the URL inside `text` rather than `url`.
export function draftFromShare({ title = '', text = '', url = '' } = {}) {
  const foundUrl = url || extractUrl(text) || extractUrl(title);
  const leftover = foundUrl ? text.replace(foundUrl, '').trim() : text.trim();
  const type = detectType({ url: foundUrl });
  return {
    type,
    url: foundUrl || null,
    title: title.trim() || null,
    note: type === 'text' ? [title, text].filter(Boolean).join('\n').trim() : leftover || null,
  };
}

export function youTubeThumbnail(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
