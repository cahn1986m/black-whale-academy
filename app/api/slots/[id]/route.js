import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { recomputeExpiryDate } from '@/lib/expiryDate';

export const dynamic = 'force-dynamic';

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
