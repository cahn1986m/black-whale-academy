import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const freelancerId = Number(params.id);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const level = typeof body.level === 'string' ? body.level : '';
  const price = Number(body.price);

  const [existingFreelancer] = await sql`SELECT id FROM freelancers WHERE id = ${freelancerId}`;
  if (!existingFreelancer) {
    return NextResponse.json({ error: 'المدرب غير موجود' }, { status: 404 });
  }

  const [existingLevel] = await sql`SELECT level FROM level_default_pricing WHERE level = ${level}`;

  if (!existingLevel) {
    return NextResponse.json({ error: 'المستوى غير موجود' }, { status: 404 });
  }

  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: 'السعر يجب أن يكون رقماً موجباً' }, { status: 400 });
  }

  await sql`
    INSERT INTO freelancer_pricing_overrides (freelancer_id, level, price)
    VALUES (${freelancerId}, ${level}, ${price})
    ON CONFLICT (freelancer_id, level) DO UPDATE SET price = EXCLUDED.price
  `;

  return NextResponse.json({ success: true });
}

export async function DELETE(request, { params }) {
  const freelancerId = Number(params.id);
  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level');

  if (!level) {
    return NextResponse.json({ error: 'المستوى مطلوب' }, { status: 400 });
  }

  const [deleted] = await sql`
    DELETE FROM freelancer_pricing_overrides
    WHERE freelancer_id = ${freelancerId} AND level = ${level}
    RETURNING id
  `;

  if (!deleted) {
    return NextResponse.json({ error: 'لا يوجد سعر خاص لهذا المستوى' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
