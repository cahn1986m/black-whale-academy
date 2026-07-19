import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const AUTH_COOKIE = 'bwa_admin_session';
const CACHE_TTL_MS = 30_000;

let cachedPassword = null;
let cachedAt = 0;

async function getCurrentPassword() {
  const now = Date.now();
  if (cachedPassword !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedPassword;
  }
  try {
    const [row] = await sql`SELECT password FROM admin_settings WHERE id = 1`;
    cachedPassword = row?.password ?? null;
    cachedAt = now;
  } catch {
    // DB unreachable — don't cache a failure, just deny this request.
    return null;
  }
  return cachedPassword;
}

function isProtected(pathname, method) {
  if (pathname === '/api/admin-login' || pathname === '/api/admin-logout') return false;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true;
  if (pathname === '/api/activities') return method !== 'GET';
  if (pathname.startsWith('/api/activities/')) return true;
  if (pathname.startsWith('/api/packages/')) return true;
  if (pathname === '/api/child-list') return true;
  if (pathname.startsWith('/api/children/')) return true;
  if (pathname === '/api/admin-password') return true;
  if (pathname === '/api/reset') return true;
  return false;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname, request.method)) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  const currentPassword = cookie ? await getCurrentPassword() : null;
  const authed = Boolean(cookie) && Boolean(currentPassword) && cookie === currentPassword;

  if (authed) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
  }

  const loginUrl = new URL('/admin-login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
