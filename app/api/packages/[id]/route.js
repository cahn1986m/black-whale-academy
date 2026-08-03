import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  try {
    const id = Number(params.id);
    const body = await request.json().catch(() => ({}));

    if (body.sessionCount === undefined && body.price === undefined && body.sessionsPerWeek === undefined) {
      return NextResponse.json({ error: 'ما في شي للتحديث' }, { status: 400 });
    }

    const sessionCount = body.sessionCount !== undefined ? Number(body.sessionCount) : null;
    const price = body.price !== undefined ? Number(body.price) : null;
    const sessionsPerWeek = body.sessionsPerWeek !== undefined && body.sessionsPerWeek !== null && body.sessionsPerWeek !== ''
      ? Number(body.sessionsPerWeek)
      : null;

    if (body.sessionCount !== undefined && (!sessionCount || sessionCount <= 0)) {
      return NextResponse.json({ error: 'عدد الحصص غير صحيح' }, { status: 400 });
    }
    if (body.price !== undefined && (Number.isNaN(price) || price < 0)) {
      return NextResponse.json({ error: 'السعر غير صحيح' }, { status: 400 });
    }
    if (body.sessionsPerWeek !== undefined && sessionsPerWeek !== null && (Number.isNaN(sessionsPerWeek) || sessionsPerWeek <= 0)) {
      return NextResponse.json({ error: 'عدد الحصص الأسبوعية غير صحيح' }, { status: 400 });
    }

    const [pkg] = await sql`
      UPDATE activity_packages SET
        session_count = COALESCE(${sessionCount}, session_count),
        price = COALESCE(${price}, price),
        sessions_per_week = CASE WHEN ${body.sessionsPerWeek !== undefined} THEN ${sessionsPerWeek} ELSE sessions_per_week END
      WHERE id = ${id}
      RETURNING id, activity_id, session_count, price, sessions_per_week
    `;

    if (!pkg) {
      return NextResponse.json({ error: 'الباقة غير موجودة' }, { status: 404 });
    }

    return NextResponse.json({ package: pkg });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const id = Number(params.id);
    const [pkg] = await sql`DELETE FROM activity_packages WHERE id = ${id} RETURNING id`;
    if (!pkg) {
      return NextResponse.json({ error: 'الباقة غير موجودة' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
