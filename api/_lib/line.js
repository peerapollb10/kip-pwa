// Only same-origin relative paths are allowed as post-login destinations (no open redirect).
export function safePath(p) {
  const s = String(p || '/');
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') ? s : '/';
}

export function lineRedirectUri() {
  return `${process.env.APP_URL}/api/auth/line-callback`;
}

// LINE may not return an email (needs "OpenID Connect → Email" permission approved in the
// LINE Developers console). Fall back to a stable, non-routable address keyed by the LINE user id.
export function emailForLine({ email, sub }) {
  return email ? String(email).toLowerCase() : `line_${sub}@line.kip.invalid`;
}

export function readCookie(req, name) {
  const pair = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : null;
}
