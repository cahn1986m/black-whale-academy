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

  const [freelancer] = await sql`SELECT id, name FROM freelancers WHERE id = ${session.freelancerId}`;

  if (!freelancer) {
    return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 });
  }

  return NextResponse.json({ freelancer });
}
