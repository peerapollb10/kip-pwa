// Supabase Edge Function: OG metadata proxy (avoids browser CORS).
// POST { url } → { title, description, thumbnail_url, site_name }
// Deploy: supabase functions deploy og-metadata
// JWT verification stays on (default): the client sends the user's JWT, or the anon key for guests.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_BYTES = 512 * 1024;
const UA = 'Mozilla/5.0 (compatible; KipBot/1.0; +https://kip.app)';
// Facebook serves a login wall to unknown bots but full OG tags (incl. og:image) to its own crawler.
const FB_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.includes(':')) {
    if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  const [a, b] = v.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

// SSRF guard: only public http(s) hosts.
async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('BAD_PROTOCOL');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('PRIVATE_HOST');
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    if (isPrivateIp(host)) throw new Error('PRIVATE_HOST');
    return u;
  }
  const lookups = await Promise.allSettled([Deno.resolveDns(host, 'A'), Deno.resolveDns(host, 'AAAA')]);
  const addrs = lookups.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (!addrs.length) throw new Error('DNS_FAILED');
  if (addrs.some(isPrivateIp)) throw new Error('PRIVATE_HOST');
  return u;
}

const decode = (s?: string | null) =>
  s?.replace(/&#x([\da-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() || null;

function metaTag(html: string, key: string) {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i'))?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1]) : null;
}

async function readLimited(res: Response) {
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  const buf = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    buf.set(c.subarray(0, Math.min(c.length, size - off)), off);
    off += c.length;
  }
  return new TextDecoder().decode(buf);
}

function youTubeId(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      return u.searchParams.get('v') || u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{6,})/)?.[2] || null;
    }
  } catch { /* not a URL */ }
  return null;
}

const isFacebook = (url: string) => {
  try {
    return ['facebook.com', 'fb.watch', 'fb.com', 'fb.me'].includes(new URL(url).hostname.replace(/^(www\.|m\.|web\.)/, ''));
  } catch {
    return false;
  }
};

async function fromYouTube(url: string, id: string) {
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(6000) });
  const data = res.ok ? await res.json() : {};
  return { title: data.title || null, description: data.author_name || null, thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, site_name: 'YouTube' };
}

async function fromHtml(url: string) {
  let current = await assertPublicUrl(url);
  let res: Response | undefined;
  // Follow redirects manually so every hop passes the SSRF check.
  for (let hop = 0; hop < 4; hop++) {
    const headers = { 'User-Agent': isFacebook(current.href) ? FB_UA : UA, Accept: 'text/html' };
    res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(6000), headers });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) {
      await res.body?.cancel();
      current = await assertPublicUrl(new URL(loc, current).href);
    } else break;
  }
  if (!res || !res.ok || !(res.headers.get('content-type') || '').includes('text/html')) return {};
  const html = await readLimited(res);
  const image = metaTag(html, 'og:image') || metaTag(html, 'twitter:image');
  return {
    title: metaTag(html, 'og:title') || metaTag(html, 'twitter:title') || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]),
    description: metaTag(html, 'og:description') || metaTag(html, 'description'),
    thumbnail_url: image ? new URL(image, current).href : null,
    site_name: metaTag(html, 'og:site_name') || current.hostname.replace(/^www\./, ''),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const { url } = await req.json().catch(() => ({ url: '' }));
  if (typeof url !== 'string' || !url) return json({ error: 'URL_REQUIRED' }, 400);

  try {
    const id = youTubeId(url);
    const meta: Record<string, string | null> = id ? await fromYouTube(url, id) : await fromHtml(url);
    if (isFacebook(url) && !meta.site_name) meta.site_name = 'Facebook';
    return json(meta);
  } catch {
    return json({}); // client falls back to hostname
  }
});
