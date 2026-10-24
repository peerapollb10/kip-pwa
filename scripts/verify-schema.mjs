// Read-only check that the plan/limit/admin schema is live on the linked Supabase project.
// Usage: node scripts/verify-schema.mjs   (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local)
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const base = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

// [label, path, method, expected status, body]
const checks = [
  ['profiles.role / subscription_tier / pro_until', '/rest/v1/profiles?select=id,role,subscription_tier,pro_until&limit=0', 'GET', 200],
  ['items.deleted_at', '/rest/v1/items?select=id,deleted_at&limit=0', 'GET', 200],
  ['subscriptions.admin_note / expires_at', '/rest/v1/subscriptions?select=id,admin_note,expires_at&limit=0', 'GET', 200],
  ['rpc get_pro_count (public)', '/rest/v1/rpc/get_pro_count', 'POST', 200, '{}'],
  // Admin RPCs are revoked from anon → 401/403/404-with-permission means "exists but locked"; PGRST202 = missing.
  ['rpc admin_search_users (locked to anon)', '/rest/v1/rpc/admin_search_users', 'POST', 'locked', '{"q":""}'],
  ['payment_slips table (0006)', '/rest/v1/payment_slips?select=id,status,slip_path&limit=0', 'GET', 200],
  ['rpc submit_payment_slip (locked to anon)', '/rest/v1/rpc/submit_payment_slip', 'POST', 'locked', '{"p_interval":"month","p_amount":0,"p_slip_path":"x"}'],
  ['rpc admin_list_slips (locked to anon)', '/rest/v1/rpc/admin_list_slips', 'POST', 'locked', '{"p_status":"pending"}'],
  ['rpc admin_review_slip (locked to anon)', '/rest/v1/rpc/admin_review_slip', 'POST', 'locked', '{"p_slip":"00000000-0000-0000-0000-000000000000","p_approve":false,"p_note":null}'],
  ['rpc admin_set_plan (locked to anon)', '/rest/v1/rpc/admin_set_plan', 'POST', 'locked', '{"p_user":"00000000-0000-0000-0000-000000000000","p_tier":"free","p_duration":"month","p_note":null}'],
];

let failed = 0;
for (const [label, path, method, expected, body] of checks) {
  const res = await fetch(base + path, { method, headers, body });
  const text = await res.text();
  const ok = expected === 'locked' ? !text.includes('PGRST202') && res.status >= 400 : res.status === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} → ${res.status} ${text.slice(0, 120)}`);
}
process.exit(failed ? 1 : 0);
