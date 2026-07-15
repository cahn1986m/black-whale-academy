import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'DELETE ALL') {
      return NextResponse.json({ error: 'تأكيد غير صحيح' }, { status: 400 });
    }

    const beforeCount = await sql`SELECT COUNT(*)::int AS count FROM children`;

    const deletedAttendance = await sql`DELETE FROM attendance RETURNING id`;
    const deletedChildren = await sql`DELETE FROM children RETURNING id`;
    const deletedGroups = await sql`DELETE FROM groups RETURNING id`;

    const afterCount = await sql`SELECT COUNT(*)::int AS count FROM children`;

    return NextResponse.json({
      success: true,
      beforeCount: beforeCount[0].count,
      afterCount: afterCount[0].count,
      deletedAttendanceCount: deletedAttendance.length,
      deletedChildrenCount: deletedChildren.length,
      deletedChildrenIds: deletedChildren.map(r => r.id),
      deletedGroupsCount: deletedGroups.length,
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
