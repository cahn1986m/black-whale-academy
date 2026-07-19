import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const AUTH_COOKIE = 'bwa_admin_session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === 'string' ? body.password : '';

    if (!password) {
      return NextResponse.json({ error: 'كلمة المرور مطلوبة' }, { status: 400 });
    }

    const [row] = await sql`SELECT password FROM admin_settings WHERE id = 1`;
    if (!row) {
      return NextResponse.json({ error: 'ما في كلمة مرور معدّة على القاعدة بعد' }, { status: 500 });
    }

    if (password !== row.password) {
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
