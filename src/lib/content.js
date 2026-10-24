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

// Optional types are off until switched on in Settings; while off they save as a plain link.
export const OPTIONAL_TYPES = ['instagram', 'tiktok', 'document'];

export function detectType({ url, file } = {}, enabledOptional = OPTIONAL_TYPES) {
  if (file) return 'image';
  if (!url) return 'text';
  if (getYouTubeId(url)) return 'youtube';
  if (isFacebookUrl(url)) return 'facebook';
  const optional = isInstagramUrl(url) ? 'instagram' : isTikTokUrl(url) ? 'tiktok' : isDocumentUrl(url) ? 'document' : null;
  return optional && enabledOptional.includes(optional) ? optional : 'link';
}

// Order shown in the Dashboard type filter (optional types only when enabled).
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

export const visibleItemTypes = (enabledOptional) =>
  ITEM_TYPES.filter(([t]) => !OPTIONAL_TYPES.includes(t) || enabledOptional.includes(t));

// Normalise Web Share Target params ({title, text, url}) into a draft item.
// Many Android apps put the URL inside `text` rather than `url`.
export function draftFromShare({ title = '', text = '', url = '' } = {}, enabledOptional = OPTIONAL_TYPES) {
  const foundUrl = url || extractUrl(text) || extractUrl(title);
  const leftover = foundUrl ? text.replace(foundUrl, '').trim() : text.trim();
  const type = detectType({ url: foundUrl }, enabledOptional);
  return {
    type,
    url: foundUrl || null,
    title: title.trim() || null,
    note: type === 'text' ? [title, text].filter(Boolean).join('\n').trim() : leftover || null,
  };
}

// Web Share Target payload → SaveSheet `initial`: the URL alone goes into the composer field,
// any other shared text moves to the note (dropping a copy of the title, which apps often repeat).
export function composerFromShare({ title = '', text = '', url = '', file = null } = {}) {
  title = String(title || '').trim();
  text = String(text || '').trim();
  const foundUrl = String(url || '').trim() || extractUrl(text) || extractUrl(title);
  if (file || !foundUrl) return { title, text, note: '', file };
  const strip = (s) => s.split(foundUrl).join(' ').replace(/\s+/g, ' ').trim();
  const cleanTitle = strip(title);
  const leftover = strip(text);
  return { title: cleanTitle, text: foundUrl, note: leftover && leftover !== cleanTitle ? leftover : '', file: null };
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
