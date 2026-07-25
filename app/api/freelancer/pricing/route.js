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

  const pricing = await sql`
    SELECT
      ldp.level,
      COALESCE(fpo.price, ldp.price) AS price
    FROM level_default_pricing ldp
    LEFT JOIN freelancer_pricing_overrides fpo
      ON fpo.level = ldp.level AND fpo.freelancer_id = ${session.freelancerId}
    ORDER BY ldp.level
  `;

  return NextResponse.json({ pricing });
}
