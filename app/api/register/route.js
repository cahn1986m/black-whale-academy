import { NextResponse } from 'next/server';
import { customAlphabet } from 'nanoid';
import { sql } from '@/lib/db';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);
const MAX_TOKEN_ATTEMPTS = 5;

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const fullName = (body.fullName || '').trim();
    const parentContact = (body.parentContact || '').trim();
    const groupId = body.groupId ? Number(body.groupId) : null;
    const photoBase64 = body.photoBase64 || null;

    if (!fullName) {
      return NextResponse.json({ error: 'اسم الطفل مطلوب' }, { status: 400 });
    }

    let child;
    for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt++) {
      const qrToken = nanoid();
      try {
        [child] = await sql`
          INSERT INTO children (full_name, parent_contact, group_id, photo_base64, qr_token)
          VALUES (${fullName}, ${parentContact || null}, ${groupId}, ${photoBase64}, ${qrToken})
          RETURNING id, full_name, qr_token
        `;
        break;
      } catch (err) {
        if (err.code === '23505' && attempt < MAX_TOKEN_ATTEMPTS - 1) {
          continue;
        }
        throw err;
      }
    }

    if (!child) {
      return NextResponse.json({ error: 'ما قدرنا نولّد كود فريد، حاول مرة تانية' }, { status: 500 });
    }

    return NextResponse.json({ child });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
