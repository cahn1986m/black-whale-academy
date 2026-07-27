import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const instructors = await sql`
    SELECT i.*, COALESCE(ib.current_balance, 0) AS current_balance
    FROM instructors i
    LEFT JOIN instructor_balances ib ON ib.instructor_id = i.id
    ORDER BY i.name ASC
  `;

  return NextResponse.json({ instructors });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  const defaultRatePerSession = Number(body.default_rate_per_session);

  if (!name) {
    return NextResponse.json({ error: 'اسم المدرب مطلوب' }, { status: 400 });
  }

  if (!Number.isFinite(defaultRatePerSession) || defaultRatePerSession <= 0) {
    return NextResponse.json({ error: 'سعر الحصة لازم يكون رقم أكبر من صفر' }, { status: 400 });
  }

  try {
    const [row] = await sql`
      INSERT INTO instructors (name, contact, default_rate_per_session)
      VALUES (${name}, ${contact || null}, ${defaultRatePerSession})
      RETURNING id
    `;

    return NextResponse.json({ success: true, instructorId: row.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
  }
}
