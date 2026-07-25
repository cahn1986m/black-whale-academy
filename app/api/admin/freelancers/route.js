import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PIN_REGEX = /^\d{4}$/;

export async function GET() {
  const freelancers = await sql`
    SELECT
      f.id, f.name, f.phone, f.payment_type, f.is_active, f.created_at,
      COALESCE(fb.current_balance, 0) AS current_balance
    FROM freelancers f
    LEFT JOIN freelancer_balances fb ON fb.freelancer_id = f.id
    ORDER BY f.name ASC
  `;

  return NextResponse.json({ freelancers });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const pin = typeof body.pin === 'string' ? body.pin : '';

  if (!name || !phone) {
    return NextResponse.json({ error: 'الاسم ورقم الجوال مطلوبان' }, { status: 400 });
  }

  if (!PIN_REGEX.test(pin)) {
    return NextResponse.json({ error: 'الرمز يجب أن يكون 4 أرقام بالضبط' }, { status: 400 });
  }

  const [existing] = await sql`SELECT id FROM freelancers WHERE phone = ${phone}`;

  if (existing) {
    return NextResponse.json({ error: 'رقم الجوال مسجّل مسبقاً' }, { status: 400 });
  }

  const pinHash = await bcrypt.hash(pin, 10);

  try {
    const [row] = await sql`
      INSERT INTO freelancers (name, phone, pin_hash)
      VALUES (${name}, ${phone}, ${pinHash})
      RETURNING id
    `;

    return NextResponse.json({ success: true, freelancerId: row.id });
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ error: 'رقم الجوال مسجّل مسبقاً' }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
  }
}
