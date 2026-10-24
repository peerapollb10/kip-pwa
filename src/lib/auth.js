// Auth provider registry. Pure (no supabase import) so it runs under `node --test`.
// flow 'supabase' → supabase.auth.signInWithOAuth (provider enabled in Supabase Dashboard → Auth → Providers)
// flow 'redirect' → our own endpoint finishes the sign-in and hands a Supabase session back (see api/auth/line*.js)
export const AUTH_PROVIDERS = {
  google: {
    id: 'google',
    name: 'Google',
    label: 'ลงชื่อเข้าใช้ด้วย Google',
    flow: 'supabase',
    // Always show the account chooser — users often have several Gmail accounts on one phone.
    queryParams: { prompt: 'select_account' },
  },
  line: {
    id: 'line',
    name: 'LINE',
    label: 'เข้าสู่ระบบด้วย LINE',
    flow: 'redirect',
    endpoint: '/api/auth/line',
  },
};

export const PROVIDER_ORDER = ['google', 'line'];

export const LOGIN_ERRORS = {
  LINE_CANCELLED: 'ยกเลิกการเข้าสู่ระบบด้วย LINE',
  LINE_STATE: 'เซสชันหมดอายุ ลองใหม่อีกครั้ง',
  LINE_TOKEN: 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ',
  LINE_VERIFY: 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ',
  LINE_FAILED: 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ',
};

export function loginErrorMessage(code) {
  if (!code) return null;
  return LOGIN_ERRORS[code] || 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง';
}

// session: undefined = still resolving, null = guest, object = member.
export function authStatus(session) {
  if (session === undefined) return 'loading';
  return session ? 'member' : 'guest';
}

// Normalise a Supabase user into what the UI shows (header avatar, Settings account card).
// LINE users are created by the service role (app_metadata.provider = 'email'), so check user_metadata first.
export function describeUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  const provider = meta.provider === 'line' || meta.line_user_id ? 'line' : user.app_metadata?.provider === 'google' ? 'google' : 'email';
  const email = user.email && !user.email.endsWith('.invalid') ? user.email : null; // hide the LINE placeholder address
  const name = meta.full_name || meta.name || (email ? email.split('@')[0] : 'ผู้ใช้ Kip');
  return {
    provider,
    providerName: AUTH_PROVIDERS[provider]?.name ?? 'Email',
    name,
    email,
    avatarUrl: meta.avatar_url || meta.picture || null,
    initial: name.trim().charAt(0).toUpperCase() || 'K',
  };
}
