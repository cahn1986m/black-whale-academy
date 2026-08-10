import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { DAYS_OF_WEEK, isWithinBusinessHours } from '@/lib/businessHours';

export const dynamic = 'force-dynamic';

function addOneHour(startTime) {
  const [h] = startTime.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:00`;
}

export async function POST(request, { params }) {
  try {
    const activityId = Number(params.id);
    const body = await request.json().catch(() => ({}));
    const dayOfWeek = body.dayOfWeek;
    const startTime = typeof body.startTime === 'string' ? body.startTime.trim() : '';

    if (!DAYS_OF_WEEK.includes(dayOfWeek)) {
      return NextResponse.json({ error: 'يوم الأسبوع غير صحيح' }, { status: 400 });
    }
    // Real club operating hours — form/API policy, not a DB constraint
    // (see lib/businessHours.js), so this can change without a migration.
    if (!isWithinBusinessHours(dayOfWeek, startTime)) {
      return NextResponse.json({ error: 'الوقت خارج ساعات الدوام لهذا اليوم' }, { status: 400 });
    }

    const [activity] = await sql`SELECT id FROM activities WHERE id = ${activityId}`;
    if (!activity) {
      return NextResponse.json({ error: 'النشاط غير موجود' }, { status: 404 });
    }

    const endTime = addOneHour(startTime);

    try {
      const [slot] = await sql`
        INSERT INTO activity_time_slots (activity_id, day_of_week, start_time, end_time)
        VALUES (${activityId}, ${dayOfWeek}, ${startTime}, ${endTime})
        RETURNING id, activity_id, day_of_week, start_time, end_time
      `;
      return NextResponse.json({ slot });
    } catch (err) {
      if (err.code === '23505') {
        return NextResponse.json({ error: 'هذه الخانة موجودة أصلاً لهذا النشاط' }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
