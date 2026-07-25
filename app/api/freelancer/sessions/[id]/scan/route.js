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
    SELECT id FROM freelancer_sessions
    WHERE id = ${sessionId} AND freelancer_id = ${session.freelancerId}
  `;

  if (!freelancerSession) {
    return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token : '';

  if (!token) {
    return NextResponse.json({ error: 'الرمز مطلوب' }, { status: 400 });
  }

  try {
    await sql`SELECT scan_freelancer_qr_token(${sessionId}, ${token})`;
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err.code === 'P0001') {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
  }
}
