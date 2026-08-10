import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Counts active + pending_approval only — a cancelled/rejected
    // enrollment shouldn't inflate "X مشترك"/"X enrolled" (that count is
    // meant to reflect real or pending subscribers), but pending_approval
    // still counts so the activity stays visible in the /attendance
    // activity dropdown (staff needs to be able to select it and see why
    // that trainee is blocked, not have the activity silently disappear).
    const activities = await sql`
      SELECT a.id, a.name, a.emoji, a.instructor_name, a.instructor_id, a.schedule_text,
        COUNT(DISTINCT e.child_id) FILTER (WHERE e.status IN ('active', 'pending_approval'))::int AS enrolled_count
      FROM activities a
      LEFT JOIN enrollments e ON e.activity_id = a.id
      GROUP BY a.id
      ORDER BY a.created_at ASC
    `;
    const packages = await sql`
      SELECT id, activity_id, session_count, price, sessions_per_week
      FROM activity_packages
      ORDER BY activity_id ASC, session_count ASC
    `;
    const slots = await sql`
      SELECT id, activity_id, day_of_week, start_time, end_time
      FROM activity_time_slots
      ORDER BY activity_id ASC, day_of_week ASC, start_time ASC
    `;

    const packagesByActivity = new Map();
    for (const pkg of packages) {
      const list = packagesByActivity.get(pkg.activity_id) || [];
      list.push(pkg);
      packagesByActivity.set(pkg.activity_id, list);
    }
    const slotsByActivity = new Map();
    for (const slot of slots) {
      const list = slotsByActivity.get(slot.activity_id) || [];
      list.push(slot);
      slotsByActivity.set(slot.activity_id, list);
    }

    const result = activities.map((a) => ({
      ...a,
      packages: packagesByActivity.get(a.id) || [],
      slots: slotsByActivity.get(a.id) || [],
    }));

    return NextResponse.json({ activities: result }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = (body.name || '').trim();
    const emoji = (body.emoji || '').trim() || null;
    const instructorName = (body.instructorName || '').trim() || null;
    const scheduleText = (body.scheduleText || '').trim() || null;

    if (!name) {
      return NextResponse.json({ error: 'اسم النشاط مطلوب' }, { status: 400 });
    }

    const [activity] = await sql`
      INSERT INTO activities (name, emoji, instructor_name, schedule_text)
      VALUES (${name}, ${emoji}, ${instructorName}, ${scheduleText})
      RETURNING id, name, emoji, instructor_name, schedule_text
    `;

    return NextResponse.json({ activity: { ...activity, packages: [] } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
