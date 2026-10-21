// "Remember me" support for the Auth.js session cookie.
//
// Auth.js always issues the session cookie with an Expires date (30 days,
// refreshed on every request). When the user signs in without "Remember me",
// we strip that date so the browser treats it as a session cookie and drops it
// when the browser closes. As a backstop (browsers that restore session
// cookies), such sessions also expire server-side after a fixed lifetime.

/** Absolute lifetime of a session signed in without "Remember me". */
export const SHORT_SESSION_MS = 24 * 60 * 60 * 1000;

/** Response header the proxy uses internally to flag non-remembered sessions. */
export const SESSION_ONLY_HEADER = 'x-session-only-cookie';

/** Matches `authjs.session-token`, its `__Secure-` variant and chunks (`.0`, `.1`, …). */
export function isSessionTokenCookie(name: string): boolean {
  return /^(__Secure-)?authjs\.session-token(\.\d+)?$/.test(name);
}

/**
 * Turns a persistent session-token `Set-Cookie` header into a browser-session
 * cookie by removing `Expires` / `Max-Age`. Other cookies, and deletions
 * (empty value), are returned unchanged.
 */
export function toBrowserSessionCookie(setCookie: string): string {
  const [nameValue, ...attrs] = setCookie.split(';');
  const eq = nameValue.indexOf('=');
  const name = nameValue.slice(0, eq).trim();
  const value = nameValue.slice(eq + 1).trim();
  if (eq === -1 || !isSessionTokenCookie(name) || value === '') return setCookie;
  const kept = attrs.filter((a) => !/^\s*(expires|max-age)\s*=/i.test(a));
  return [nameValue, ...kept].join(';');
}
