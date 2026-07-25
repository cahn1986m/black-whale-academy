import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyFreelancerSession } from '@/lib/freelancer-session';

export const dynamic = 'force-dynamic';

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
    SELECT id, status FROM freelancer_sessions
    WHERE id = ${sessionId} AND freelancer_id = ${session.freelancerId}
  `;

  if (!freelancerSession) {
    return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 });
  }

  if (!['approved', 'checked_in'].includes(freelancerSession.status)) {
    return NextResponse.json({ error: 'لا يمكن إغلاق هذه الجلسة بحالتها الحالية' }, { status: 400 });
  }

  try {
    await sql`SELECT close_freelancer_session(${sessionId}, 'manual')`;
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err.code === 'P0001') {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
  }
}
