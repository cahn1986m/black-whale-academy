import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Applies one decision (approve/reject) to every pending_approval
// enrollment a given trainee has at once — the point of review is to
// verify the trainee's registration is legitimate, not to litigate each
// activity separately.
export async function POST(request, { params }) {
  try {
    const childId = Number(params.childId);
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'إجراء غير صحيح' }, { status: 400 });
    }

    if (action === 'approve') {
      const updated = await sql`
        UPDATE enrollments SET
          status = 'active',
          status_reason = NULL,
          status_changed_at = now()
        WHERE child_id = ${childId} AND status = 'pending_approval'
        RETURNING id
      `;
      if (updated.length === 0) {
        return NextResponse.json({ error: 'ما في تسجيلات معلّقة لهالمتدرب' }, { status: 404 });
      }
      return NextResponse.json({ success: true, count: updated.length });
    }

    const reason = (body.reason || '').trim();
    if (!reason) {
      return NextResponse.json({ error: 'سبب الرفض مطلوب' }, { status: 400 });
    }

    const updated = await sql`
      UPDATE enrollments SET
        status = 'rejected',
        status_reason = ${reason},
        status_changed_at = now()
      WHERE child_id = ${childId} AND status = 'pending_approval'
      RETURNING id
    `;
    if (updated.length === 0) {
      return NextResponse.json({ error: 'ما في تسجيلات معلّقة لهالمتدرب' }, { status: 404 });
    }
    return NextResponse.json({ success: true, count: updated.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
