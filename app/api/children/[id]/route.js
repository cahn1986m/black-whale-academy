import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const id = Number(params.id);
    const [child] = await sql`
      SELECT id, full_name, parent_contact, group_id, photo_base64, qr_token
      FROM children WHERE id = ${id}
    `;
    if (!child) {
      return NextResponse.json({ error: 'الطفل غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ child });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const id = Number(params.id);
    const body = await request.json();

    if (body.groupId !== undefined) {
      const groupId = body.groupId ? Number(body.groupId) : null;
      const [child] = await sql`
        UPDATE children SET group_id = ${groupId} WHERE id = ${id}
        RETURNING id, full_name, group_id
      `;
      return NextResponse.json({ child });
    }

    return NextResponse.json({ error: 'ما في شي للتحديث' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
