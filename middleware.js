import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyFreelancerSession } from '@/lib/freelancer-session';

const AUTH_COOKIE = 'bwa_admin_session';
const CACHE_TTL_MS = 30_000;
const FREELANCER_AUTH_COOKIE = 'bwa_freelancer_session';
const STAFF_AUTH_COOKIE = 'bwa_staff_session';

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
  if (pathname === '/api/admin/reset-freelancer-test-data') return true;
  if (pathname.startsWith('/api/admin/')) return true;
  return false;
}

function isFreelancerPath(pathname) {
  return pathname.startsWith('/api/freelancer/') || pathname.startsWith('/freelancer/');
}

let cachedStaffPassword = null;
let cachedStaffAt = 0;

async function getCurrentStaffPassword() {
  const now = Date.now();
  if (cachedStaffPassword !== null && now - cachedStaffAt < CACHE_TTL_MS) {
    return cachedStaffPassword;
  }
  try {
    const [row] = await sql`SELECT password FROM staff_settings WHERE id = 1`;
    cachedStaffPassword = row?.password ?? null;
    cachedStaffAt = now;
  } catch {
    // DB unreachable — don't cache a failure, just deny this request.
    return null;
  }
  return cachedStaffPassword;
}

function isStaffProtected(pathname, method) {
  if (pathname === '/api/staff-login' || pathname === '/api/staff-logout') return false;
  if (pathname === '/staff/login') return false;
  if (pathname === '/staff' || pathname.startsWith('/staff/')) return true;
  if (pathname === '/attendance' || pathname.startsWith('/attendance/')) return true;
  if (pathname === '/api/attendance') return method !== 'GET';
  if (pathname.startsWith('/api/staff/')) return true;
  return false;
}

// These two exact route+method combos are used by BOTH the admin
// approval panel (level-count/cost breakdown display) AND the staff
// scan page — so they must accept either a valid staff cookie or a
// valid admin cookie. Everything else under
// /api/admin/freelancer-sessions/* (the list, and PATCH for
// approve/reject) stays admin-cookie-only, unchanged.
function isDualAuthRoute(pathname, method) {
  if (/^\/api\/admin\/freelancer-sessions\/\d+$/.test(pathname) && method === 'GET') return true;
  if (/^\/api\/admin\/freelancer-sessions\/\d+\/scan$/.test(pathname) && method === 'POST') return true;
  return false;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (isFreelancerPath(pathname)) {
    // The login route is the gate itself — it must stay reachable
    // while logged out, same reasoning as /api/admin-login above.
    if (pathname === '/api/freelancer/login' || pathname === '/freelancer/login') {
      return NextResponse.next();
    }

    const freelancerCookie = request.cookies.get(FREELANCER_AUTH_COOKIE)?.value;
    const session = freelancerCookie ? await verifyFreelancerSession(freelancerCookie) : null;

    if (session) {
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
    }

    const loginUrl = new URL('/freelancer/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isDualAuthRoute(pathname, request.method)) {
    const staffCookie = request.cookies.get(STAFF_AUTH_COOKIE)?.value;
    const currentStaffPassword = staffCookie ? await getCurrentStaffPassword() : null;
    const staffAuthed = Boolean(staffCookie) && Boolean(currentStaffPassword) && staffCookie === currentStaffPassword;

    if (staffAuthed) return NextResponse.next();

    const adminCookie = request.cookies.get(AUTH_COOKIE)?.value;
    const currentAdminPassword = adminCookie ? await getCurrentPassword() : null;
    const adminAuthed = Boolean(adminCookie) && Boolean(currentAdminPassword) && adminCookie === currentAdminPassword;

    if (adminAuthed) return NextResponse.next();

    return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
  }

  if (isStaffProtected(pathname, request.method)) {
    const staffCookie = request.cookies.get(STAFF_AUTH_COOKIE)?.value;
    const currentStaffPassword = staffCookie ? await getCurrentStaffPassword() : null;
    const staffAuthed = Boolean(staffCookie) && Boolean(currentStaffPassword) && staffCookie === currentStaffPassword;

    if (staffAuthed) {
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
    }

    const staffLoginUrl = new URL('/staff/login', request.url);
    staffLoginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(staffLoginUrl);
  }

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
  matcher: ['/admin/:path*', '/api/:path*', '/freelancer/:path*', '/attendance/:path*', '/staff/:path*'],
};
