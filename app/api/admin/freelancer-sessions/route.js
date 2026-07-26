import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');
  const statusArray = statusParam
    ? statusParam.split(',').map((s) => s.trim()).filter(Boolean)
    : null;

  const sessions = statusArray && statusArray.length > 0
    ? await sql`
        SELECT
          fs.id, fs.freelancer_id, f.name AS freelancer_name, f.phone AS freelancer_phone,
          fs.session_date, fs.session_time, fs.status, fs.closed_at, fs.closed_by,
          fs.rejected_at, fs.rejection_reason, fs.created_at
        FROM freelancer_sessions fs
        JOIN freelancers f ON f.id = fs.freelancer_id
        WHERE fs.status = ANY(${statusArray})
        ORDER BY fs.session_date DESC, fs.session_time DESC
      `
    : await sql`
        SELECT
          fs.id, fs.freelancer_id, f.name AS freelancer_name, f.phone AS freelancer_phone,
          fs.session_date, fs.session_time, fs.status, fs.closed_at, fs.closed_by,
          fs.rejected_at, fs.rejection_reason, fs.created_at
        FROM freelancer_sessions fs
        JOIN freelancers f ON f.id = fs.freelancer_id
        ORDER BY fs.session_date DESC, fs.session_time DESC
      `;

  return NextResponse.json({ sessions });
}
