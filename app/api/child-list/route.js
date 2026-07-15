import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    const children = groupId
      ? await sql`
          SELECT id, full_name, parent_contact, group_id, photo_base64, qr_token
          FROM children
          WHERE group_id = ${Number(groupId)}
          ORDER BY id ASC
        `
      : await sql`
          SELECT id, full_name, parent_contact, group_id, photo_base64, qr_token
          FROM children
          ORDER BY id ASC
        `;

    return NextResponse.json({ children }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0',
        'Pragma': 'no-cache',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
