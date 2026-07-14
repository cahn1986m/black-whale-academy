import { NextResponse } from 'next/server';
import { customAlphabet } from 'nanoid';
import { sql } from '@/lib/db';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);

export async function POST(request) {
  try {
    const body = await request.json();
    const fullName = (body.fullName || '').trim();
    const parentContact = (body.parentContact || '').trim();
    const groupId = body.groupId ? Number(body.groupId) : null;
    const photoBase64 = body.photoBase64 || null;

    if (!fullName) {
      return NextResponse.json({ error: 'اسم الطفل مطلوب' }, { status: 400 });
    }

    const qrToken = nanoid();

    const [child] = await sql`
      INSERT INTO children (full_name, parent_contact, group_id, photo_base64, qr_token)
      VALUES (${fullName}, ${parentContact || null}, ${groupId}, ${photoBase64}, ${qrToken})
      RETURNING id, full_name, qr_token
    `;

    return NextResponse.json({ child });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
