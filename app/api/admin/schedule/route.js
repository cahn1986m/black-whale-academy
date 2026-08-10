import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        ts.id AS slot_id, ts.activity_id, a.name AS activity_name, a.emoji,
        ts.day_of_week, ts.start_time, ts.end_time,
        c.id AS child_id, c.full_name
      FROM activity_time_slots ts
      JOIN activities a ON a.id = ts.activity_id
      LEFT JOIN enrollment_slot_assignments esa ON esa.slot_id = ts.id
      LEFT JOIN enrollments e ON e.id = esa.enrollment_id AND e.status = 'active'
      LEFT JOIN children c ON c.id = e.child_id
      ORDER BY ts.day_of_week ASC, ts.start_time ASC, c.full_name ASC
    `;

    const slotsById = new Map();
    for (const row of rows) {
      let slot = slotsById.get(row.slot_id);
      if (!slot) {
        slot = {
          id: row.slot_id,
          activity_id: row.activity_id,
          activity_name: row.activity_name,
          emoji: row.emoji,
          day_of_week: row.day_of_week,
          start_time: row.start_time,
          end_time: row.end_time,
          children: [],
        };
        slotsById.set(row.slot_id, slot);
      }
      if (row.child_id) {
        slot.children.push({ id: row.child_id, full_name: row.full_name });
      }
    }

    return NextResponse.json({ slots: Array.from(slotsById.values()) }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
