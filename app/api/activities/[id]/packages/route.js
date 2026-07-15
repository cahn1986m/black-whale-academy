import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const activityId = Number(params.id);
    const body = await request.json().catch(() => ({}));
    const sessionCount = Number(body.sessionCount);
    const price = Number(body.price);

    if (!sessionCount || sessionCount <= 0) {
      return NextResponse.json({ error: 'عدد الحصص مطلوب' }, { status: 400 });
    }
    if (price === undefined || price === null || Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: 'السعر مطلوب' }, { status: 400 });
    }

    const [activity] = await sql`SELECT id FROM activities WHERE id = ${activityId}`;
    if (!activity) {
      return NextResponse.json({ error: 'النشاط غير موجود' }, { status: 404 });
    }

    const [pkg] = await sql`
      INSERT INTO activity_packages (activity_id, session_count, price)
      VALUES (${activityId}, ${sessionCount}, ${price})
      RETURNING id, activity_id, session_count, price
    `;

    return NextResponse.json({ package: pkg });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
