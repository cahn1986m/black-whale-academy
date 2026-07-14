import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL || '';
    const hostMatch = dbUrl.match(/@([^/]+)\//);
    const dbNameMatch = dbUrl.match(/\/([^?]+)(\?|$)/);

    const countRows = await sql`SELECT COUNT(*)::int AS count FROM children`;
    const allRows = await sql`SELECT id, full_name, created_at FROM children ORDER BY id`;

    return NextResponse.json({
      host: hostMatch ? hostMatch[1] : 'unknown',
      database: dbNameMatch ? dbNameMatch[1] : 'unknown',
      countFromQuery: countRows[0].count,
      rowsReturned: allRows.length,
      rows: allRows,
      gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || 'unknown',
      env: process.env.VERCEL_ENV || 'unknown',
      region: process.env.VERCEL_REGION || 'unknown',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
