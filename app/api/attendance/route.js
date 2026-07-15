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
    const groupId = searchParams.get('groupId');

    const rows = groupId
      ? await sql`
          SELECT c.id AS child_id, c.full_name, c.photo_base64,
            a.status, a.marked_at
          FROM children c
          LEFT JOIN attendance a ON a.child_id = c.id AND a.attendance_date = ${date}
          WHERE c.group_id = ${Number(groupId)}
          ORDER BY c.full_name ASC
        `
      : await sql`
          SELECT c.id AS child_id, c.full_name, c.photo_base64, c.group_id,
            a.status, a.marked_at
          FROM children c
          LEFT JOIN attendance a ON a.child_id = c.id AND a.attendance_date = ${date}
          ORDER BY c.full_name ASC
        `;

    return NextResponse.json({ date, records: rows }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const date = body.date || todayStr();
    const status = VALID_STATUSES.includes(body.status) ? body.status : 'present';
    const qrToken = typeof body.qrToken === 'string' ? body.qrToken.trim() : '';
    let childId = body.childId ? Number(body.childId) : null;

    if (!childId && qrToken) {
      const [child] = await sql`SELECT id FROM children WHERE qr_token = ${qrToken}`;
      if (!child) {
        return NextResponse.json({ error: 'الكود غير معروف — تأكد من مسح QR الصحيح' }, { status: 404 });
      }
      childId = child.id;
    }

    if (!childId) {
      return NextResponse.json({ error: 'لازم رقم الطفل أو كود QR' }, { status: 400 });
    }

    let record;
    try {
      [record] = await sql`
        INSERT INTO attendance (child_id, attendance_date, status)
        VALUES (${childId}, ${date}, ${status})
        ON CONFLICT (child_id, attendance_date)
        DO UPDATE SET status = ${status}, marked_at = now()
        RETURNING child_id, attendance_date, status, marked_at
      `;
    } catch (err) {
      if (err.code === '23503') {
        return NextResponse.json({ error: 'الطفل ما عاد موجود بالنظام' }, { status: 404 });
      }
      throw err;
    }

    const [child] = await sql`SELECT id, full_name, group_id FROM children WHERE id = ${childId}`;

    return NextResponse.json({ record, child });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
