import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyFreelancerSession } from '@/lib/freelancer-session';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const cookie = request.cookies.get('bwa_freelancer_session')?.value;
  const session = cookie ? await verifyFreelancerSession(cookie) : null;

  if (!session) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
  }

  const [freelancer] = await sql`SELECT is_active FROM freelancers WHERE id = ${session.freelancerId}`;

  if (!freelancer || !freelancer.is_active) {
    return NextResponse.json({ error: 'هذا الحساب معطّل، تواصل مع الإدارة' }, { status: 403 });
  }

  const sessionId = Number(params.id);

  const [freelancerSession] = await sql`
    SELECT id, session_date, session_time, status, closed_at, closed_by, rejected_at, rejection_reason, created_at
    FROM freelancer_sessions
    WHERE id = ${sessionId} AND freelancer_id = ${session.freelancerId}
  `;

  if (!freelancerSession) {
    return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 });
  }

  const levelCounts = await sql`
    SELECT level, child_count
    FROM freelancer_session_level_counts
    WHERE session_id = ${sessionId}
  `;

  const qrTokens = await sql`
    SELECT id, level, token, status, expires_at, scanned_at
    FROM session_qr_tokens
    WHERE session_id = ${sessionId}
  `;

  return NextResponse.json({ session: freelancerSession, levelCounts, qrTokens });
}
