// GET /api/auth/line-callback?code&state — LINE → Supabase session.
// 1) exchange code, 2) verify id_token with LINE, 3) find/create the Supabase user,
// 4) hand off via a one-time magic link so supabase-js picks up the session in the browser.
import { supabaseAdmin } from '../_lib/server.js';
import { emailForLine, lineRedirectUri, readCookie } from '../_lib/line.js';

const fail = (res, reason) => res.redirect(302, `/login?error=${encodeURIComponent(reason)}`);

export default async function handler(req, res) {
  res.setHeader('Set-Cookie', 'kip_line=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  const { code, state, error } = req.query;
  if (error) return fail(res, 'LINE_CANCELLED');

  let saved;
  try {
    saved = JSON.parse(Buffer.from(readCookie(req, 'kip_line') || '', 'base64url').toString());
  } catch {
    return fail(res, 'LINE_STATE');
  }
  if (!code || !state || state !== saved.state) return fail(res, 'LINE_STATE');

  try {
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: lineRedirectUri(),
        client_id: process.env.LINE_CHANNEL_ID,
        client_secret: process.env.LINE_CHANNEL_SECRET,
      }),
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.id_token) return fail(res, 'LINE_TOKEN');

    // LINE verifies signature, audience, expiry and nonce for us.
    const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: token.id_token, client_id: process.env.LINE_CHANNEL_ID, nonce: saved.nonce }),
    });
    const claims = await verifyRes.json();
    if (!verifyRes.ok || !claims.sub) return fail(res, 'LINE_VERIFY');

    const email = emailForLine(claims);
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: claims.name, avatar_url: claims.picture, line_user_id: claims.sub, provider: 'line' },
    });
    // "already registered" is fine — same LINE account (or same verified email) signs in again.
    if (createError && !/already|exists|registered/i.test(createError.message)) throw createError;

    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${process.env.APP_URL}${saved.from || '/'}` },
    });
    if (linkError) throw linkError;
    return res.redirect(302, data.properties.action_link);
  } catch (e) {
    console.error('line login error', e);
    return fail(res, 'LINE_FAILED');
  }
}
