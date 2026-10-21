import { describe, expect, it } from 'vitest';
import { isSessionTokenCookie, toBrowserSessionCookie } from '@/lib/remember-me';

describe('isSessionTokenCookie', () => {
  it('matches the session token, its secure variant and chunks', () => {
    expect(isSessionTokenCookie('authjs.session-token')).toBe(true);
    expect(isSessionTokenCookie('__Secure-authjs.session-token')).toBe(true);
    expect(isSessionTokenCookie('authjs.session-token.1')).toBe(true);
    expect(isSessionTokenCookie('authjs.csrf-token')).toBe(false);
    expect(isSessionTokenCookie('authjs.callback-url')).toBe(false);
  });
});

describe('toBrowserSessionCookie', () => {
  it('strips Expires and Max-Age from the session token cookie', () => {
    const c = 'authjs.session-token=abc; Path=/; Expires=Fri, 20 Nov 2026 00:00:00 GMT; Max-Age=2592000; HttpOnly; SameSite=Lax';
    expect(toBrowserSessionCookie(c)).toBe('authjs.session-token=abc; Path=/; HttpOnly; SameSite=Lax');
  });

  it('leaves other cookies untouched', () => {
    const c = 'authjs.csrf-token=xyz; Path=/; Expires=Fri, 20 Nov 2026 00:00:00 GMT';
    expect(toBrowserSessionCookie(c)).toBe(c);
  });

  it('leaves session token deletions untouched', () => {
    const c = 'authjs.session-token=; Path=/; Max-Age=0';
    expect(toBrowserSessionCookie(c)).toBe(c);
  });
});
