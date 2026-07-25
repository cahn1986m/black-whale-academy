import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const VALID_PAYMENT_TYPES = ['prepaid', 'monthly', 'on_account'];

export async function GET(request, { params }) {
  const freelancerId = Number(params.id);

  const [freelancer] = await sql`
    SELECT
      f.id, f.name, f.phone, f.failed_login_attempts, f.locked_until, f.payment_type,
      f.is_active, f.created_at, COALESCE(fb.current_balance, 0) AS current_balance
    FROM freelancers f
    LEFT JOIN freelancer_balances fb ON fb.freelancer_id = f.id
    WHERE f.id = ${freelancerId}
  `;

  if (!freelancer) {
    return NextResponse.json({ error: 'المدرب غير موجود' }, { status: 404 });
  }

  const pricingOverrides = await sql`
    SELECT id, level, price, created_at
    FROM freelancer_pricing_overrides
    WHERE freelancer_id = ${freelancerId}
  `;

  return NextResponse.json({ freelancer, pricingOverrides });
}

export async function PATCH(request, { params }) {
  const freelancerId = Number(params.id);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const hasPaymentType = Object.prototype.hasOwnProperty.call(body, 'payment_type');
  const hasIsActive = Object.prototype.hasOwnProperty.call(body, 'is_active');

  if (hasPaymentType && !VALID_PAYMENT_TYPES.includes(body.payment_type)) {
    return NextResponse.json({ error: 'قيمة payment_type غير صالحة' }, { status: 400 });
  }

  if (hasIsActive && typeof body.is_active !== 'boolean') {
    return NextResponse.json({ error: 'قيمة is_active غير صالحة' }, { status: 400 });
  }

  if (!hasPaymentType && !hasIsActive) {
    return NextResponse.json({ error: 'لا يوجد أي تعديل مطلوب' }, { status: 400 });
  }

  const [existing] = await sql`SELECT id FROM freelancers WHERE id = ${freelancerId}`;
  if (!existing) {
    return NextResponse.json({ error: 'المدرب غير موجود' }, { status: 404 });
  }

  if (hasPaymentType && hasIsActive) {
    await sql`
      UPDATE freelancers
      SET payment_type = ${body.payment_type}, is_active = ${body.is_active}
      WHERE id = ${freelancerId}
    `;
  } else if (hasPaymentType) {
    await sql`UPDATE freelancers SET payment_type = ${body.payment_type} WHERE id = ${freelancerId}`;
  } else {
    await sql`UPDATE freelancers SET is_active = ${body.is_active} WHERE id = ${freelancerId}`;
  }

  return NextResponse.json({ success: true });
}
