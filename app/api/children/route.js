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

    return NextResponse.json({ children });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
