import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const sessionId = Number(params.id);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token : '';

  if (!token) {
    return NextResponse.json({ error: 'الرمز مطلوب' }, { status: 400 });
  }

  try {
    await sql`SELECT scan_freelancer_qr_token(${sessionId}, ${token})`;
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err.code === 'P0001') {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
  }
}
