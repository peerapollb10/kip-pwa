// Guest Mode: everything lives in localStorage until the user signs in with Gmail / LINE,
// then migrateGuestData() (api.js) moves it up to Supabase.
const KEY = 'kip.guest.v1';

// No default categories — users create their own; uncategorised items have category_id = null.
// Older guest vaults were seeded with these names; an untouched seed isn't worth migrating.
const LEGACY_SEED_NAMES = 'ความรู้ / บทความ|บันเทิง / คลิปวิดีโอ|งาน / โปรเจกต์|ช้อปปิ้ง / ของที่อยากได้|ทั่วไป';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `g-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function seed() {
  return {
    profile: { view_mode: 'grid', onboarded: false, quick_mode: false, subscription_tier: 'free', pro_until: null, role: 'user' },
    categories: [],
    items: [],
  };
}

// Older vaults still carry the seeded categories; drop the ones nothing was filed into.
function dropEmptySeedCategories(state) {
  const seeded = LEGACY_SEED_NAMES.split('|');
  const used = new Set(state.items.map((i) => i.category_id));
  return { ...state, categories: state.categories.filter((c) => !seeded.includes(c.name) || used.has(c.id)) };
}

export function loadGuest(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY);
    if (raw) return dropEmptySeedCategories(JSON.parse(raw));
  } catch {
    /* corrupted → reseed */
  }
  const fresh = seed();
  saveGuest(fresh, storage);
  return fresh;
}

// Throws QUOTA_EXCEEDED when localStorage is full (images are stored as WebP data URLs).
export function saveGuest(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    const err = new Error('QUOTA_EXCEEDED');
    err.code = 'QUOTA_EXCEEDED';
    err.cause = e;
    throw err;
  }
}

export function clearGuest(storage = globalThis.localStorage) {
  storage.removeItem(KEY);
}

// After a successful migration: empty vault, but don't replay onboarding after a later sign-out.
export function resetGuest(storage = globalThis.localStorage) {
  const fresh = seed();
  fresh.profile.onboarded = true;
  saveGuest(fresh, storage);
}

// Worth migrating only if the guest actually saved something or customised categories.
export function hasGuestData(storage = globalThis.localStorage) {
  try {
    const s = JSON.parse(storage.getItem(KEY) || 'null');
    if (!s) return false;
    const names = s.categories.map((c) => c.name).join('|');
    return s.items.length > 0 || (names !== '' && names !== LEGACY_SEED_NAMES);
  } catch {
    return false;
  }
}

export function newGuestItem(draft, categoryId, imageDataUrl) {
  return {
    id: uid(),
    type: draft.type,
    content_url: draft.url || null,
    title: draft.title || (draft.file ? draft.file.name : null),
    description: draft.description || null,
    thumbnail_url: draft.thumbnail_url || null,
    site_name: draft.site_name || null,
    note: draft.note || null,
    image_url: imageDataUrl || null, // data URL; uploaded to Storage on migration
    image_path: null,
    category_id: categoryId || null,
    is_favorite: false,
    created_at: new Date().toISOString(),
  };
}

export function newGuestCategory(name, emoji, position) {
  return { id: uid(), name, emoji, position, is_default: false };
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
