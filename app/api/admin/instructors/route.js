import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const VALID_PAY_TYPES = ['per_session', 'monthly'];

export async function GET() {
  const instructors = await sql`
    SELECT i.*, COALESCE(ib.current_balance, 0) AS current_balance
    FROM instructors i
    LEFT JOIN instructor_balances ib ON ib.instructor_id = i.id
    ORDER BY i.name ASC
  `;

  return NextResponse.json({ instructors });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  const payType = body.pay_type;

  if (!name) {
    return NextResponse.json({ error: 'اسم المدرب مطلوب' }, { status: 400 });
  }

  if (!VALID_PAY_TYPES.includes(payType)) {
    return NextResponse.json({ error: 'نوع الدفع يجب أن يكون بالحصة اليومية أو راتب شهري' }, { status: 400 });
  }

  let defaultRatePerDay = null;
  let monthlySalary = null;
  let monthlyAbsenceDeduction = null;

  if (payType === 'per_session') {
    defaultRatePerDay = Number(body.default_rate_per_day);
    if (!Number.isFinite(defaultRatePerDay) || defaultRatePerDay <= 0) {
      return NextResponse.json({ error: 'سعر الحصة لازم يكون رقم أكبر من صفر' }, { status: 400 });
    }
  } else {
    monthlySalary = Number(body.monthly_salary);
    if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) {
      return NextResponse.json({ error: 'الراتب الشهري لازم يكون رقم أكبر من صفر' }, { status: 400 });
    }

    monthlyAbsenceDeduction = Number(body.monthly_absence_deduction);
    if (!Number.isFinite(monthlyAbsenceDeduction) || monthlyAbsenceDeduction <= 0) {
      return NextResponse.json({ error: 'مبلغ خصم الغياب لازم يكون رقم أكبر من صفر' }, { status: 400 });
    }
  }

  try {
    const [row] = await sql`
      INSERT INTO instructors (name, contact, pay_type, default_rate_per_day, monthly_salary, monthly_absence_deduction)
      VALUES (${name}, ${contact || null}, ${payType}, ${defaultRatePerDay}, ${monthlySalary}, ${monthlyAbsenceDeduction})
      RETURNING id
    `;

    return NextResponse.json({ success: true, instructorId: row.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
  }
}
