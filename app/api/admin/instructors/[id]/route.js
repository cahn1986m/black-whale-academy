import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const instructorId = Number(params.id);

  const [instructor] = await sql`
    SELECT i.*, COALESCE(ib.current_balance, 0) AS current_balance
    FROM instructors i
    LEFT JOIN instructor_balances ib ON ib.instructor_id = i.id
    WHERE i.id = ${instructorId}
  `;

  if (!instructor) {
    return NextResponse.json({ error: 'المدرب غير موجود' }, { status: 404 });
  }

  const linkedActivities = await sql`
    SELECT id, name FROM activities WHERE instructor_id = ${instructorId}
  `;

  return NextResponse.json({ instructor, linkedActivities });
}

export async function PATCH(request, { params }) {
  const instructorId = Number(params.id);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
  const hasContact = Object.prototype.hasOwnProperty.call(body, 'contact');
  const hasRate = Object.prototype.hasOwnProperty.call(body, 'default_rate_per_session');
  const hasActive = Object.prototype.hasOwnProperty.call(body, 'active');

  let name;
  let contact;
  let defaultRatePerSession;

  if (hasName) {
    name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'اسم المدرب مطلوب' }, { status: 400 });
    }
  }

  if (hasContact) {
    contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  }

  if (hasRate) {
    defaultRatePerSession = Number(body.default_rate_per_session);
    if (!Number.isFinite(defaultRatePerSession) || defaultRatePerSession <= 0) {
      return NextResponse.json({ error: 'سعر الحصة لازم يكون رقم أكبر من صفر' }, { status: 400 });
    }
  }

  if (hasActive && typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'قيمة active غير صالحة' }, { status: 400 });
  }

  if (!hasName && !hasContact && !hasRate && !hasActive) {
    return NextResponse.json({ error: 'لا يوجد أي تعديل مطلوب' }, { status: 400 });
  }

  const [existing] = await sql`SELECT id FROM instructors WHERE id = ${instructorId}`;
  if (!existing) {
    return NextResponse.json({ error: 'المدرب غير موجود' }, { status: 404 });
  }

  const [updated] = await sql`
    UPDATE instructors SET
      name = CASE WHEN ${hasName} THEN ${hasName ? name : null} ELSE name END,
      contact = CASE WHEN ${hasContact} THEN ${hasContact ? (contact || null) : null} ELSE contact END,
      default_rate_per_session = CASE WHEN ${hasRate} THEN ${hasRate ? defaultRatePerSession : null} ELSE default_rate_per_session END,
      active = CASE WHEN ${hasActive} THEN ${hasActive ? body.active : null} ELSE active END
    WHERE id = ${instructorId}
    RETURNING id
  `;

  return NextResponse.json({ success: true });
}
