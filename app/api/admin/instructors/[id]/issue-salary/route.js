import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const instructorId = Number(params.id);

  const [existing] = await sql`SELECT id FROM instructors WHERE id = ${instructorId}`;
  if (!existing) {
    return NextResponse.json({ error: 'المدرب غير موجود' }, { status: 404 });
  }

  try {
    await sql`SELECT issue_monthly_salary(${instructorId})`;
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err.code === 'P0001') {
      if (err.message.includes('is not on a monthly pay_type')) {
        return NextResponse.json({ error: 'هذا المدرب مش براتب شهري' }, { status: 400 });
      }
      if (err.message.includes('no monthly_salary configured')) {
        return NextResponse.json({ error: 'ما في راتب شهري محدد لهالمدرب' }, { status: 400 });
      }
      if (err.message.includes('already issued') && err.message.includes('this month')) {
        return NextResponse.json({ error: 'تم إصدار راتب هالشهر لهالمدرب مسبقاً' }, { status: 400 });
      }
      console.error('Unrecognized P0001 from issue_monthly_salary:', err.message);
      return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
    }
    console.error(err);
    return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
  }
}
