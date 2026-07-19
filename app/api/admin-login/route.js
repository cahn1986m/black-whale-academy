import { NextResponse } from 'next/server';

const AUTH_COOKIE = 'bwa_admin_session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === 'string' ? body.password : '';

    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'كلمة المرور غير معدّة على السيرفر بعد' }, { status: 500 });
    }

    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(AUTH_COOKIE, password, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
