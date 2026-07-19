import { NextResponse } from 'next/server';

const AUTH_COOKIE = 'bwa_admin_session';

function isProtected(pathname, method) {
  if (pathname === '/api/admin-login' || pathname === '/api/admin-logout') return false;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true;
  if (pathname === '/api/activities') return method !== 'GET';
  if (pathname.startsWith('/api/activities/')) return true;
  if (pathname.startsWith('/api/packages/')) return true;
  if (pathname === '/api/child-list') return true;
  if (pathname.startsWith('/api/children/')) return true;
  if (pathname === '/api/reset') return true;
  return false;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname, request.method)) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  const authed = Boolean(cookie) && cookie === process.env.ADMIN_PASSWORD;

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
