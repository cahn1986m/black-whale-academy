import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'DELETE ALL') {
      return NextResponse.json({ error: 'تأكيد غير صحيح' }, { status: 400 });
    }

    await sql`DELETE FROM attendance`;
    await sql`DELETE FROM children`;
    await sql`DELETE FROM groups`;

    return NextResponse.json({ success: true }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
