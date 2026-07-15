import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    const children = groupId
      ? await sql`
          SELECT id, full_name, parent_contact, group_id, photo_base64, qr_token
          FROM children
          WHERE group_id = ${Number(groupId)}
          ORDER BY full_name ASC
        `
      : await sql`
          SELECT id, full_name, parent_contact, group_id, photo_base64, qr_token
          FROM children
          ORDER BY full_name ASC
        `;

    const rawCount = await sql`SELECT COUNT(*)::int AS count FROM children`;

    return NextResponse.json({
      children,
      _debug: {
        childrenLength: children.length,
        rawCountFromDb: rawCount[0].count,
        groupIdParam: groupId,
        gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID || 'unknown',
        timestamp: new Date().toISOString(),
      },
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
