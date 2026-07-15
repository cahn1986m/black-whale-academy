import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const activities = await sql`
      SELECT a.id, a.name, a.emoji, a.instructor_name, a.schedule_text,
        COUNT(DISTINCT e.child_id)::int AS enrolled_count
      FROM activities a
      LEFT JOIN enrollments e ON e.activity_id = a.id
      GROUP BY a.id
      ORDER BY a.created_at ASC
    `;
    const packages = await sql`
      SELECT id, activity_id, session_count, price
      FROM activity_packages
      ORDER BY activity_id ASC, session_count ASC
    `;

    const packagesByActivity = new Map();
    for (const pkg of packages) {
      const list = packagesByActivity.get(pkg.activity_id) || [];
      list.push(pkg);
      packagesByActivity.set(pkg.activity_id, list);
    }

    const result = activities.map((a) => ({
      ...a,
      packages: packagesByActivity.get(a.id) || [],
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
