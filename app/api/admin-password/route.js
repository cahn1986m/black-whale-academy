import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const AUTH_COOKIE = 'bwa_admin_session';
const MIN_LENGTH = 4;

export const dynamic = 'force-dynamic';

export async function PATCH(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : '';

    if (!currentPassword) {
      return NextResponse.json({ error: 'كلمة المرور الحالية مطلوبة' }, { status: 400 });
    }
    if (!newPassword || newPassword.length < MIN_LENGTH) {
      return NextResponse.json({ error: `كلمة المرور الجديدة لازم تكون ${MIN_LENGTH} أحرف على الأقل` }, { status: 400 });
    }

    const [row] = await sql`SELECT password FROM admin_settings WHERE id = 1`;
    if (!row || currentPassword !== row.password) {
      return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 401 });
    }

    await sql`UPDATE admin_settings SET password = ${newPassword}, updated_at = now() WHERE id = 1`;

    const res = NextResponse.json({ success: true });
    res.cookies.set(AUTH_COOKIE, newPassword, {
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
