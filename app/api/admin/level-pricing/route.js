import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pricing = await sql`SELECT level, price, updated_at FROM level_default_pricing ORDER BY level`;
  return NextResponse.json({ pricing });
}

export async function PATCH(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const level = typeof body.level === 'string' ? body.level : '';
  const price = Number(body.price);

  const [existing] = await sql`SELECT level FROM level_default_pricing WHERE level = ${level}`;

  if (!existing) {
    return NextResponse.json({ error: 'المستوى غير موجود' }, { status: 404 });
  }

  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: 'السعر يجب أن يكون رقماً موجباً' }, { status: 400 });
  }

  await sql`UPDATE level_default_pricing SET price = ${price}, updated_at = now() WHERE level = ${level}`;

  return NextResponse.json({ success: true });
}
