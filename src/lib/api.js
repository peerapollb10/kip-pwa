import { supabase, IMAGE_BUCKET } from './supabase.js';
import { compressToWebp } from './image.js';
import { getYouTubeId, youTubeThumbnail, hostnameOf } from './content.js';

export class LimitError extends Error {
  constructor() {
    super('FREE_LIMIT_REACHED');
    this.code = 'FREE_LIMIT_REACHED';
  }
}

function raise(error) {
  if (!error) return;
  if (error.message?.includes('FREE_LIMIT_REACHED')) throw new LimitError();
  throw error;
}

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

// ── Metadata (Supabase Edge Function proxy — avoids CORS) ──
export async function fetchMetadata(url) {
  const ytId = getYouTubeId(url);
  const fallback = {
    title: null,
    description: null,
    thumbnail_url: ytId ? youTubeThumbnail(ytId) : null,
    site_name: hostnameOf(url),
  };
  try {
    const { data, error } = await supabase.functions.invoke('og-metadata', { body: { url } });
    if (error || !data) return fallback;
    return { ...fallback, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v)) };
  } catch {
    return fallback;
  }
}

// ── Items ──
export async function listItems() {
  const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: false });
  raise(error);
  return withImageUrls(data);
}

export async function withImageUrls(items) {
  const paths = items.filter((i) => i.image_path).map((i) => i.image_path);
  if (!paths.length) return items;
  const { data } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 60 * 60 * 24);
  const map = Object.fromEntries((data || []).map((d) => [d.path, d.signedUrl]));
  return items.map((i) => (i.image_path ? { ...i, image_url: map[i.image_path] } : i));
}

async function uploadImage(userId, blob, ext) {
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, { contentType: blob.type });
  raise(error);
  return path;
}

async function insertItem(row, image_path) {
  let { data, error } = await supabase.from('items').insert({ ...row, image_path }).select().single();
  // DB without migration 0003 rejects instagram/tiktok/document → keep the save, store as a plain link.
  if (error?.code === '23514' && error.message?.includes('items_type_check') && row.type !== 'link') {
    ({ data, error } = await supabase.from('items').insert({ ...row, type: 'link', image_path }).select().single());
  }
  if (error && image_path) await supabase.storage.from(IMAGE_BUCKET).remove([image_path]);
  raise(error);
  return data;
}

export async function createItem({ userId, draft, categoryId }) {
  let image_path = null;
  if (draft.file) {
    const { blob, ext } = await compressToWebp(draft.file);
    image_path = await uploadImage(userId, blob, ext);
  }
  const data = await insertItem(
    {
      type: draft.type,
      content_url: draft.url || null,
      title: draft.title || (draft.file ? draft.file.name : null),
      description: draft.description || null,
      thumbnail_url: draft.thumbnail_url || null,
      site_name: draft.site_name || null,
      note: draft.note || null,
      category_id: categoryId || null,
    },
    image_path,
  );
  const [withUrl] = await withImageUrls([data]);
  return withUrl;
}

export async function updateItem(id, patch) {
  const { data, error } = await supabase.from('items').update(patch).eq('id', id).select().single();
  raise(error);
  return data;
}

export async function updateItems(ids, patch) {
  const { error } = await supabase.from('items').update(patch).in('id', ids);
  raise(error);
}

// Trash = soft delete; restore clears deleted_at (DB re-checks the Free limit on restore).
export const trashItems = (ids) => updateItems(ids, { deleted_at: new Date().toISOString() });
export const restoreItems = (ids) => updateItems(ids, { deleted_at: null });

// Permanent delete (row + uploaded image).
export async function deleteItems(items) {
  const { error } = await supabase.from('items').delete().in('id', items.map((i) => i.id));
  raise(error);
  const paths = items.filter((i) => i.image_path).map((i) => i.image_path);
  if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
}

// ── Categories ──
export async function listCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('position');
  raise(error);
  return data;
}

export async function createCategory(name, emoji, position) {
  const { data, error } = await supabase.from('categories').insert({ name, emoji, position }).select().single();
  raise(error);
  return data;
}

export async function updateCategory(id, patch) {
  const { data, error } = await supabase.from('categories').update(patch).eq('id', id).select().single();
  raise(error);
  return data;
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  raise(error);
}

// ── Guest → account migration ──
// Categories are matched by name (missing ones are created); images are re-uploaded to Storage.
// Returns { migrated, remaining } — `remaining` are guest items that didn't fit (Free limit) and stay local.
export async function migrateGuestData({ userId, guest, serverCategories }) {
  const byName = Object.fromEntries(serverCategories.map((c) => [c.name, c]));
  const idMap = {};
  let position = serverCategories.length;
  for (const gc of guest.categories) {
    if (!byName[gc.name]) byName[gc.name] = await createCategory(gc.name, gc.emoji, position++);
    idMap[gc.id] = byName[gc.name].id;
  }

  // Oldest first so created_at order stays natural. Trashed guest items aren't migrated.
  const queue = guest.items.filter((i) => !i.deleted_at).sort((a, b) => a.created_at.localeCompare(b.created_at));
  let migrated = 0;
  while (queue.length) {
    const it = queue[0];
    try {
      let image_path = null;
      if (it.image_url?.startsWith('data:')) {
        const blob = await (await fetch(it.image_url)).blob();
        image_path = await uploadImage(userId, blob, blob.type === 'image/webp' ? 'webp' : 'jpg');
      }
      await insertItem(
        {
          type: it.type,
          content_url: it.content_url,
          title: it.title,
          description: it.description,
          thumbnail_url: it.thumbnail_url,
          site_name: it.site_name,
          note: it.note,
          is_favorite: it.is_favorite,
          category_id: idMap[it.category_id] || null,
          created_at: it.created_at,
        },
        image_path,
      );
    } catch (e) {
      if (e.code === 'FREE_LIMIT_REACHED') break;
      e.remaining = queue; // lets the caller keep only un-migrated items (no duplicates on retry)
      throw e;
    }
    queue.shift();
    migrated++;
  }
  return { migrated, remaining: queue };
}

// ── Profile / billing ──
export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  raise(error);
  return data;
}

export async function updateProfile(userId, patch) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select().single();
  raise(error);
  return data;
}

export async function getSubscription(userId) {
  const { data } = await supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
  return data;
}

export async function getProCount() {
  const { data, error } = await supabase.rpc('get_pro_count');
  raise(error);
  return data ?? 0;
}

export async function startCheckout({ interval, method }) {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ interval, method }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'CHECKOUT_FAILED');
  window.location.assign(body.url);
}

export async function sendFeedback({ type, message, rating }) {
  const { data } = await supabase.auth.getSession();
  const { error } = await supabase.from('feedbacks').insert({
    user_id: data.session?.user.id ?? null,
    type,
    message: message || null,
    rating: type === 'rating' ? rating : null,
    user_agent: navigator.userAgent,
  });
  raise(error);
}

// ── Auth ──
export async function signInWithGoogle(from = '/') {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${from}` },
  });
  if (error) throw error;
}

// LINE isn't a built-in Supabase provider → handled by /api/auth/line (see api/auth/line.js).
export function signInWithLine(from = '/') {
  window.location.assign(`/api/auth/line?from=${encodeURIComponent(from)}`);
}

// ── Admin (RPCs check role = 'admin' server-side) ──
export async function adminStats() {
  const { data, error } = await supabase.rpc('admin_stats');
  raise(error);
  return data;
}

export async function adminSearchUsers(q) {
  const { data, error } = await supabase.rpc('admin_search_users', { q });
  raise(error);
  return data;
}

export async function adminSetPlan({ userId, tier, duration, note }) {
  const { error } = await supabase.rpc('admin_set_plan', {
    p_user: userId,
    p_tier: tier,
    p_duration: duration,
    p_note: note || null,
  });
  raise(error);
}
