import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const sessionId = Number(params.id);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const status = body.status;
  const rejectionReason = typeof body.rejectionReason === 'string' ? body.rejectionReason.trim() : '';

  if (status !== 'approved' && status !== 'rejected') {
    return NextResponse.json({ error: 'قيمة status غير صالحة' }, { status: 400 });
  }

  if (status === 'rejected' && !rejectionReason) {
    return NextResponse.json({ error: 'سبب الرفض مطلوب' }, { status: 400 });
  }

  const [existing] = await sql`SELECT id, status FROM freelancer_sessions WHERE id = ${sessionId}`;

  if (!existing || existing.status !== 'pending') {
    return NextResponse.json({ error: 'لا يمكن تعديل حالة هذه الجلسة' }, { status: 400 });
  }

  if (status === 'approved') {
    await sql`UPDATE freelancer_sessions SET status = 'approved' WHERE id = ${sessionId}`;
  } else {
    await sql`
      UPDATE freelancer_sessions
      SET status = 'rejected', rejected_at = now(), rejection_reason = ${rejectionReason}
      WHERE id = ${sessionId}
    `;
  }

  return NextResponse.json({ success: true });
}
