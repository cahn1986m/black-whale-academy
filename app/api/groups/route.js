import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const groups = await sql`
      SELECT g.id, g.name, g.supervisor_name,
        COUNT(c.id)::int AS children_count
      FROM groups g
      LEFT JOIN children c ON c.group_id = g.id
      GROUP BY g.id
      ORDER BY g.created_at ASC
    `;
    return NextResponse.json({ groups });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = (body.name || '').trim();
    const supervisorName = (body.supervisorName || '').trim();

    if (!name) {
      return NextResponse.json({ error: 'اسم المجموعة مطلوب' }, { status: 400 });
    }

    const [group] = await sql`
      INSERT INTO groups (name, supervisor_name)
      VALUES (${name}, ${supervisorName || null})
      RETURNING id, name, supervisor_name
    `;

    return NextResponse.json({ group });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
