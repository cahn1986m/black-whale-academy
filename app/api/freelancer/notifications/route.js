import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyFreelancerSession } from '@/lib/freelancer-session';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const cookie = request.cookies.get('bwa_freelancer_session')?.value;
  const session = cookie ? await verifyFreelancerSession(cookie) : null;

  if (!session) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
  }

  const [freelancer] = await sql`SELECT is_active FROM freelancers WHERE id = ${session.freelancerId}`;

  if (!freelancer || !freelancer.is_active) {
    return NextResponse.json({ error: 'هذا الحساب معطّل، تواصل مع الإدارة' }, { status: 403 });
  }

  const notifications = await sql`
    SELECT fn.id, fn.session_id, fn.event_type, fn.is_read, fn.read_at, fn.created_at, fs.session_date, fs.session_time
    FROM freelancer_notifications fn
    JOIN freelancer_sessions fs ON fs.id = fn.session_id
    WHERE fn.recipient_type = 'freelancer' AND fn.recipient_id = ${session.freelancerId}
    ORDER BY fn.created_at DESC
  `;

  return NextResponse.json({ notifications });
}
