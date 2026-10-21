import { auth } from '@/lib/auth';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { SESSION_ONLY_HEADER, toBrowserSessionCookie } from '@/lib/remember-me';

const PUBLIC_PATHS = ['/login', '/signup', '/api/auth'];

const authProxy = auth((req) => {
  if (req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL(req.auth ? '/dashboard' : '/login', req.nextUrl.origin));
  }
  const isPublic = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  if (!req.auth && !isPublic) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }
  // Flag sessions signed in without "Remember me" so the refreshed cookie below stays a session cookie.
  if ((req.auth as { remember?: boolean } | null)?.remember === false) {
    const res = NextResponse.next();
    res.headers.set(SESSION_ONLY_HEADER, '1');
    return res;
  }
});

export default async function proxy(req: NextRequest, ev: NextFetchEvent) {
  const res = (await authProxy(req, ev as never)) as Response;
  if (!res.headers.has(SESSION_ONLY_HEADER)) return res;

  res.headers.delete(SESSION_ONLY_HEADER);
  const setCookies = res.headers.getSetCookie();
  res.headers.delete('set-cookie');
  for (const c of setCookies) res.headers.append('set-cookie', toBrowserSessionCookie(c));
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
