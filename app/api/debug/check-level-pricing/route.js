import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const countResult = await sql`SELECT COUNT(*) AS count FROM level_default_pricing`;
  const rows = await sql`SELECT level, price FROM level_default_pricing ORDER BY level`;

  const dbUrl = process.env.DATABASE_URL || '';
  const hostMatch = dbUrl.match(/@([^/]+)\//);
  const dbHost = hostMatch ? hostMatch[1] : 'unknown';

  return NextResponse.json({
    count: countResult[0]?.count,
    rows,
    dbHost,
  });
}
