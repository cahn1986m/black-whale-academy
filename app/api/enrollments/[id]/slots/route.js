import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { recomputeExpiryDate } from '@/lib/expiryDate';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const enrollmentId = Number(params.id);
    const assignments = await sql`
      SELECT slot_id FROM enrollment_slot_assignments WHERE enrollment_id = ${enrollmentId}
    `;
    return NextResponse.json({ slotIds: assignments.map((a) => a.slot_id) }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const enrollmentId = Number(params.id);
    const body = await request.json().catch(() => ({}));
    const slotId = Number(body.slotId);

    if (!slotId) {
      return NextResponse.json({ error: 'الخانة الزمنية مطلوبة' }, { status: 400 });
    }

    const [enrollment] = await sql`SELECT id, activity_id FROM enrollments WHERE id = ${enrollmentId}`;
    if (!enrollment) {
      return NextResponse.json({ error: 'الاشتراك غير موجود' }, { status: 404 });
    }
    const [slot] = await sql`SELECT id, activity_id FROM activity_time_slots WHERE id = ${slotId}`;
    if (!slot) {
      return NextResponse.json({ error: 'الخانة الزمنية غير موجودة' }, { status: 404 });
    }
    if (slot.activity_id !== enrollment.activity_id) {
      return NextResponse.json({ error: 'الخانة الزمنية لا تتبع نشاط هذا الاشتراك' }, { status: 400 });
    }

    try {
      await sql`
        INSERT INTO enrollment_slot_assignments (enrollment_id, slot_id)
        VALUES (${enrollmentId}, ${slotId})
      `;
    } catch (err) {
      if (err.code !== '23505') throw err; // already assigned — treat as success
    }

    const updated = await recomputeExpiryDate(enrollmentId);
    return NextResponse.json({ success: true, expiryDate: updated.expiry_date });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const enrollmentId = Number(params.id);
    const { searchParams } = new URL(request.url);
    const slotId = Number(searchParams.get('slotId'));

    if (!slotId) {
      return NextResponse.json({ error: 'الخانة الزمنية مطلوبة' }, { status: 400 });
    }

    await sql`
      DELETE FROM enrollment_slot_assignments WHERE enrollment_id = ${enrollmentId} AND slot_id = ${slotId}
    `;

    const updated = await recomputeExpiryDate(enrollmentId);
    return NextResponse.json({ success: true, expiryDate: updated.expiry_date });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
