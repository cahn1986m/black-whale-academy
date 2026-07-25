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

  const entries = await sql`
    SELECT id, entry_type, amount, balance_after, note, related_session_id, reversed_entry_id, created_at
    FROM freelancer_ledger_entries
    WHERE freelancer_id = ${session.freelancerId}
    ORDER BY id DESC
  `;

  const [balanceRow] = await sql`
    SELECT current_balance FROM freelancer_balances WHERE freelancer_id = ${session.freelancerId}
  `;

  return NextResponse.json({
    entries,
    currentBalance: balanceRow?.current_balance ?? 0,
  });
}
