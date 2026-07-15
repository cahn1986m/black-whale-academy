import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  try {
    const id = Number(params.id);
    const body = await request.json().catch(() => ({}));

    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({ error: 'اسم النشاط مطلوب' }, { status: 400 });
    }

    if (body.name === undefined && body.emoji === undefined && body.instructorName === undefined && body.scheduleText === undefined) {
      return NextResponse.json({ error: 'ما في شي للتحديث' }, { status: 400 });
    }

    const [activity] = await sql`
      UPDATE activities SET
        name = COALESCE(${body.name !== undefined ? body.name.trim() : null}, name),
        emoji = CASE WHEN ${body.emoji !== undefined} THEN ${body.emoji || null} ELSE emoji END,
        instructor_name = CASE WHEN ${body.instructorName !== undefined} THEN ${body.instructorName || null} ELSE instructor_name END,
        schedule_text = CASE WHEN ${body.scheduleText !== undefined} THEN ${body.scheduleText || null} ELSE schedule_text END
      WHERE id = ${id}
      RETURNING id, name, emoji, instructor_name, schedule_text
    `;

    if (!activity) {
      return NextResponse.json({ error: 'النشاط غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ activity });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const id = Number(params.id);

    const [{ count: enrolledCount }] = await sql`
      SELECT COUNT(*)::int AS count FROM enrollments WHERE activity_id = ${id}
    `;

    const [activity] = await sql`DELETE FROM activities WHERE id = ${id} RETURNING id`;
    if (!activity) {
      return NextResponse.json({ error: 'النشاط غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedEnrollmentsCount: enrolledCount });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
