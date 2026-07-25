import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from '@/lib/db';
import { verifyFreelancerSession } from '@/lib/freelancer-session';
import { uaeSessionDateTimeToUtc } from '@/lib/uae-time';

export const dynamic = 'force-dynamic';

const TOKEN_VALIDITY_MS = 60 * 60 * 1000;

export async function POST(request, { params }) {
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
    SELECT id, session_date::text AS session_date, session_time, status
    FROM freelancer_sessions
    WHERE id = ${sessionId} AND freelancer_id = ${session.freelancerId}
  `;

  if (!freelancerSession) {
    return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 });
  }

  if (!['approved', 'checked_in'].includes(freelancerSession.status)) {
    return NextResponse.json({ error: 'لا يمكن توليد رموز لهذه الجلسة بحالتها الحالية' }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const level = typeof body.level === 'string' ? body.level.trim() : '';

  if (!level) {
    return NextResponse.json({ error: 'المستوى مطلوب' }, { status: 400 });
  }

  const sessionStart = uaeSessionDateTimeToUtc(freelancerSession.session_date, freelancerSession.session_time);
  const expiresAt = new Date(sessionStart.getTime() + TOKEN_VALIDITY_MS);
  const token = randomUUID();

  try {
    const [row] = await sql`
      INSERT INTO session_qr_tokens (session_id, level, token, status, expires_at)
      VALUES (${sessionId}, ${level}, ${token}, 'unused', ${expiresAt.toISOString()})
      RETURNING id, token, level, expires_at
    `;
    return NextResponse.json({
      success: true,
      token: { id: row.id, token: row.token, level: row.level, expiresAt: row.expires_at },
    });
  } catch (err) {
    if (err.code === 'P0001') {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
  }
}
