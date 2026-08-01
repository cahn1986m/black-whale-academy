import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || null;

  const instructors = await sql`
    SELECT i.id, i.name, i.pay_type, ia.status
    FROM instructors i
    LEFT JOIN instructor_attendance ia
      ON ia.instructor_id = i.id AND ia.attendance_date = COALESCE(${date}::date, CURRENT_DATE)
    WHERE i.active = true
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

  const instructorId = Number(body.instructorId);
  const status = body.status;
  const date = body.date || null;

  if (!Number.isInteger(instructorId) || instructorId <= 0) {
    return NextResponse.json({ error: 'معرف المدرب غير صالح' }, { status: 400 });
  }

  if (!['present', 'absent'].includes(status)) {
    return NextResponse.json({ error: 'حالة الحضور غير صالحة' }, { status: 400 });
  }

  try {
    await sql`SELECT record_instructor_attendance(${instructorId}, COALESCE(${date}::date, CURRENT_DATE), ${status})`;
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err.code === 'P0001') {
      if (err.message.includes('instructor % not found') || err.message.includes(`instructor ${instructorId} not found`)) {
        return NextResponse.json({ error: 'المدرب غير موجود' }, { status: 404 });
      }
      if (err.message.includes('no default_rate_per_day configured')) {
        return NextResponse.json({ error: 'ما في سعر حصة يومية محدد لهالمدرب' }, { status: 400 });
      }
      if (err.message.includes('no monthly_absence_deduction configured')) {
        return NextResponse.json({ error: 'ما في مبلغ خصم غياب محدد لهالمدرب' }, { status: 400 });
      }
      console.error('Unrecognized P0001 from record_instructor_attendance:', err.message);
      return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
    }
    console.error(err);
    return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
  }
}
