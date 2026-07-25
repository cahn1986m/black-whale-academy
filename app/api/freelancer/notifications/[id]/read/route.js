import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyFreelancerSession } from '@/lib/freelancer-session';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const cookie = request.cookies.get('bwa_freelancer_session')?.value;
  const session = cookie ? await verifyFreelancerSession(cookie) : null;

  if (!session) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
  }

  const [freelancer] = await sql`SELECT is_active FROM freelancers WHERE id = ${session.freelancerId}`;

  if (!freelancer || !freelancer.is_active) {
    return NextResponse.json({ error: 'هذا الحساب معطّل، تواصل مع الإدارة' }, { status: 403 });
  }

  const notificationId = Number(params.id);

  const [notification] = await sql`
    SELECT id FROM freelancer_notifications
    WHERE id = ${notificationId} AND recipient_type = 'freelancer' AND recipient_id = ${session.freelancerId}
  `;

  if (!notification) {
    return NextResponse.json({ error: 'الإشعار غير موجود' }, { status: 404 });
  }

  await sql`
    UPDATE freelancer_notifications
    SET is_read = true, read_at = now()
    WHERE id = ${notificationId}
  `;

  return NextResponse.json({ success: true });
}
