import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { recomputeExpiryDate } from '@/lib/expiryDate';

export const dynamic = 'force-dynamic';

// Only instructor_id is editable here — day/time are structural (part of
// the UNIQUE(activity_id, day_of_week, start_time) identity) and changing
// them would orphan existing enrollment_slot_assignments in a confusing
// way, so that stays delete-and-recreate via the existing DELETE below.
export async function PATCH(request, { params }) {
  try {
    const id = Number(params.id);
    const body = await request.json().catch(() => ({}));

    if (!Object.prototype.hasOwnProperty.call(body, 'instructorId')) {
      return NextResponse.json({ error: 'لا يوجد أي تعديل مطلوب' }, { status: 400 });
    }

    const instructorId = body.instructorId ? Number(body.instructorId) : null;

    if (instructorId) {
      const [instructor] = await sql`SELECT id FROM instructors WHERE id = ${instructorId}`;
      if (!instructor) {
        return NextResponse.json({ error: 'المدرب غير موجود' }, { status: 404 });
      }
    }

    const [slot] = await sql`
      UPDATE activity_time_slots SET instructor_id = ${instructorId}
      WHERE id = ${id}
      RETURNING id, activity_id, day_of_week, start_time, end_time, instructor_id
    `;
    if (!slot) {
      return NextResponse.json({ error: 'الخانة الزمنية غير موجودة' }, { status: 404 });
    }

    return NextResponse.json({ slot });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const id = Number(params.id);

    // Deleting a slot cascades to enrollment_slot_assignments (FK ON
    // DELETE CASCADE) — capture which enrollments were affected first so
    // their expiry_date can be recomputed afterward (losing a slot can
    // change their effective sessions/week).
    const affected = await sql`
      SELECT enrollment_id FROM enrollment_slot_assignments WHERE slot_id = ${id}
    `;

    const [slot] = await sql`DELETE FROM activity_time_slots WHERE id = ${id} RETURNING id`;
    if (!slot) {
      return NextResponse.json({ error: 'الخانة الزمنية غير موجودة' }, { status: 404 });
    }

    for (const row of affected) {
      await recomputeExpiryDate(row.enrollment_id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
