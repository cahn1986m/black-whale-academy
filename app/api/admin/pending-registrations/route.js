import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Flat list — the client groups these by child_id, since approving or
    // rejecting is a single decision about the trainee's legitimacy, not a
    // per-activity one, even when the same trainee registered for several
    // activities in the same submission.
    const rows = await sql`
      SELECT
        e.id AS enrollment_id, e.status_changed_at,
        e.sessions_total, e.price_paid,
        c.id AS child_id, c.full_name, c.photo_base64,
        c.parent_full_name, c.parent_phone, c.relationship_to_child,
        a.id AS activity_id, a.name AS activity_name, a.emoji
      FROM enrollments e
      JOIN children c ON c.id = e.child_id
      JOIN activities a ON a.id = e.activity_id
      WHERE e.status = 'pending_approval'
      ORDER BY e.status_changed_at ASC, c.full_name ASC
    `;

    return NextResponse.json({ registrations: rows }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
