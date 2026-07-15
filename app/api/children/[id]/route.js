import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const id = Number(params.id);
    const [child] = await sql`
      SELECT id, full_name, parent_contact, photo_base64, qr_token
      FROM children WHERE id = ${id}
    `;
    if (!child) {
      return NextResponse.json({ error: 'الطفل غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ child }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
