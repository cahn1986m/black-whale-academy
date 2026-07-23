import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const resetPassword = typeof body.resetPassword === 'string' ? body.resetPassword : '';

    if (resetPassword !== process.env.FREELANCER_RESET_PASSWORD) {
      return NextResponse.json({ error: 'كلمة مرور غير صحيحة' }, { status: 403 });
    }

    await sql`SELECT reset_freelancer_test_data()`;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
