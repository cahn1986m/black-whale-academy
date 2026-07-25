import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PIN_REGEX = /^\d{4}$/;

export async function PATCH(request, { params }) {
  const freelancerId = Number(params.id);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const newPin = typeof body.newPin === 'string' ? body.newPin : '';

  if (!PIN_REGEX.test(newPin)) {
    return NextResponse.json({ error: 'الرمز يجب أن يكون 4 أرقام بالضبط' }, { status: 400 });
  }

  const [existing] = await sql`SELECT id FROM freelancers WHERE id = ${freelancerId}`;
  if (!existing) {
    return NextResponse.json({ error: 'المدرب غير موجود' }, { status: 404 });
  }

  const pinHash = await bcrypt.hash(newPin, 10);

  await sql`
    UPDATE freelancers
    SET pin_hash = ${pinHash}, failed_login_attempts = 0, locked_until = NULL
    WHERE id = ${freelancerId}
  `;

  return NextResponse.json({ success: true });
}
