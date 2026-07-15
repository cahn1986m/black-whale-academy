import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['present', 'absent'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || todayStr();
    const activityId = searchParams.get('activityId');

    const rows = activityId
      ? await sql`
          SELECT e.id AS enrollment_id, c.id AS child_id, c.full_name, c.photo_base64,
            e.sessions_total,
            COALESCE(u.used_count, 0) AS sessions_used,
            e.sessions_total - COALESCE(u.used_count, 0) AS sessions_remaining,
            aa.status, aa.marked_at
          FROM enrollments e
          JOIN children c ON c.id = e.child_id
          LEFT JOIN activity_attendance aa ON aa.enrollment_id = e.id AND aa.attendance_date = ${date}
          LEFT JOIN (
            SELECT enrollment_id, COUNT(*)::int AS used_count
            FROM activity_attendance
            WHERE status = 'present'
            GROUP BY enrollment_id
          ) u ON u.enrollment_id = e.id
          WHERE e.activity_id = ${Number(activityId)}
          ORDER BY c.full_name ASC
        `
      : await sql`
          SELECT e.id AS enrollment_id, a.id AS activity_id, a.name AS activity_name,
            c.id AS child_id, c.full_name, c.photo_base64, aa.status, aa.marked_at
          FROM enrollments e
          JOIN children c ON c.id = e.child_id
          JOIN activities a ON a.id = e.activity_id
          LEFT JOIN activity_attendance aa ON aa.enrollment_id = e.id AND aa.attendance_date = ${date}
          ORDER BY a.name ASC, c.full_name ASC
        `;

    return NextResponse.json({ date, records: rows }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function getSessionsRemaining(enrollmentId) {
  const [row] = await sql`
    SELECT e.sessions_total - COALESCE(u.used_count, 0) AS sessions_remaining
    FROM enrollments e
    LEFT JOIN (
      SELECT enrollment_id, COUNT(*)::int AS used_count
      FROM activity_attendance
      WHERE status = 'present'
      GROUP BY enrollment_id
    ) u ON u.enrollment_id = e.id
    WHERE e.id = ${enrollmentId}
  `;
  return row ? row.sessions_remaining : null;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const date = body.date || todayStr();
    const status = VALID_STATUSES.includes(body.status) ? body.status : 'present';
    const qrToken = typeof body.qrToken === 'string' ? body.qrToken.trim() : '';

    let enrollmentId = body.enrollmentId ? Number(body.enrollmentId) : null;
    let childId = null;

    if (!enrollmentId) {
      const activityId = body.activityId ? Number(body.activityId) : null;
      if (!qrToken || !activityId) {
        return NextResponse.json({ error: 'لازم رقم الاشتراك أو (كود QR + النشاط)' }, { status: 400 });
      }

      const [child] = await sql`SELECT id, full_name FROM children WHERE qr_token = ${qrToken}`;
      if (!child) {
        return NextResponse.json({ error: 'الكود غير معروف — تأكد من مسح QR الصحيح' }, { status: 404 });
      }
      childId = child.id;

      const [enrollment] = await sql`
        SELECT id FROM enrollments WHERE child_id = ${childId} AND activity_id = ${activityId}
      `;
      if (!enrollment) {
        return NextResponse.json({ error: 'الطفل غير مسجل بهذا النشاط' }, { status: 404 });
      }
      enrollmentId = enrollment.id;
    }

    let record;
    try {
      [record] = await sql`
        INSERT INTO activity_attendance (enrollment_id, attendance_date, status)
        VALUES (${enrollmentId}, ${date}, ${status})
        ON CONFLICT (enrollment_id, attendance_date)
        DO UPDATE SET status = ${status}, marked_at = now()
        RETURNING enrollment_id, attendance_date, status, marked_at
      `;
    } catch (err) {
      if (err.code === '23503') {
        return NextResponse.json({ error: 'الاشتراك ما عاد موجود بالنظام' }, { status: 404 });
      }
      throw err;
    }

    if (!childId) {
      const [enrollment] = await sql`SELECT child_id FROM enrollments WHERE id = ${enrollmentId}`;
      childId = enrollment?.child_id;
    }
    const [child] = await sql`SELECT id, full_name FROM children WHERE id = ${childId}`;
    const sessionsRemaining = await getSessionsRemaining(enrollmentId);

    return NextResponse.json({ record, child, sessionsRemaining });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
