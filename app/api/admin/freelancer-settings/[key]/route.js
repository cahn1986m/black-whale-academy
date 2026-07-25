import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const key = params.key;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const value = typeof body.value === 'string' ? body.value.trim() : '';

  const [existing] = await sql`SELECT key FROM freelancer_settings WHERE key = ${key}`;

  if (!existing) {
    return NextResponse.json({ error: 'الإعداد غير موجود' }, { status: 404 });
  }

  if (!value) {
    return NextResponse.json({ error: 'القيمة مطلوبة' }, { status: 400 });
  }

  await sql`UPDATE freelancer_settings SET value = ${value}, updated_at = now() WHERE key = ${key}`;

  return NextResponse.json({ success: true });
}
