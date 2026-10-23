// GET /api/auth/line?from=/path → redirect to LINE Login (OAuth 2.1 / OIDC).
// LINE isn't a built-in Supabase provider, so /api/auth/line-callback finishes the sign-in.
import crypto from 'node:crypto';
import { safePath, lineRedirectUri } from '../_lib/line.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  const from = safePath(req.query.from);

  const cookie = Buffer.from(JSON.stringify({ state, nonce, from })).toString('base64url');
  res.setHeader('Set-Cookie', `kip_line=${cookie}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINE_CHANNEL_ID,
    redirect_uri: lineRedirectUri(),
    state,
    nonce,
    scope: 'openid profile email',
  });
  res.redirect(302, `https://access.line.me/oauth2/v2.1/authorize?${params}`);
}
