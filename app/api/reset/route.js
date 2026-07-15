import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'DELETE ALL') {
      return NextResponse.json({ error: 'تأكيد غير صحيح' }, { status: 400 });
    }

    const deletedAttendance = await sql`DELETE FROM activity_attendance RETURNING id`;
    const deletedEnrollments = await sql`DELETE FROM enrollments RETURNING id`;
    const deletedChildren = await sql`DELETE FROM children RETURNING id`;
    const deletedPackages = await sql`DELETE FROM activity_packages RETURNING id`;
    const deletedActivities = await sql`DELETE FROM activities RETURNING id`;

    return NextResponse.json({
      success: true,
      deletedAttendanceCount: deletedAttendance.length,
      deletedEnrollmentsCount: deletedEnrollments.length,
      deletedChildrenCount: deletedChildren.length,
      deletedPackagesCount: deletedPackages.length,
      deletedActivitiesCount: deletedActivities.length,
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
