import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : '';

    if (!newPassword) {
      return NextResponse.json({ error: 'كلمة المرور الجديدة مطلوبة' }, { status: 400 });
    }

    await sql`
      INSERT INTO staff_settings (id, password)
      VALUES (1, ${newPassword})
      ON CONFLICT (id) DO UPDATE SET password = ${newPassword}, updated_at = now()
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
