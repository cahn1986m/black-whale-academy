import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { uaeSessionDateTimeToUtc } from '@/lib/uae-time';

export const dynamic = 'force-dynamic';

// Same duration as the QR token validity window by design, not the same variable.
const AUTO_CLOSE_DELAY_MS = 60 * 60 * 1000;

export async function GET(request) {
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessions = await sql`
    SELECT id, freelancer_id, session_date::text AS session_date, session_time
    FROM freelancer_sessions
    WHERE status IN ('approved', 'checked_in')
  `;

  const closed = [];
  const errors = [];

  for (const row of sessions) {
    const sessionStart = uaeSessionDateTimeToUtc(row.session_date, row.session_time);
    const expiry = sessionStart.getTime() + AUTO_CLOSE_DELAY_MS;

    if (Date.now() < expiry) {
      continue;
    }

    try {
      await sql`SELECT close_freelancer_session(${row.id}, 'auto')`;
      closed.push(row.id);
    } catch (err) {
      errors.push({ sessionId: row.id, error: err.message });
    }
  }

  return NextResponse.json({
    checked: sessions.length,
    closed,
    errors,
  });
}
