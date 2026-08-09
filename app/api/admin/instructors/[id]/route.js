import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const VALID_PAY_TYPES = ['per_session', 'monthly'];

export async function GET(request, { params }) {
  const instructorId = Number(params.id);

  const [instructor] = await sql`
    SELECT i.*, COALESCE(ib.current_balance, 0) AS current_balance
    FROM instructors i
    LEFT JOIN instructor_balances ib ON ib.instructor_id = i.id
    WHERE i.id = ${instructorId}
  `;

  if (!instructor) {
    return NextResponse.json({ error: 'المدرب غير موجود' }, { status: 404 });
  }

  const linkedActivities = await sql`
    SELECT id, name FROM activities WHERE instructor_id = ${instructorId}
  `;

  return NextResponse.json({ instructor, linkedActivities });
}

export async function PATCH(request, { params }) {
  const instructorId = Number(params.id);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
  const hasContact = Object.prototype.hasOwnProperty.call(body, 'contact');
  const hasActive = Object.prototype.hasOwnProperty.call(body, 'active');

  const hasPayType = Object.prototype.hasOwnProperty.call(body, 'pay_type');
  const hasRate = Object.prototype.hasOwnProperty.call(body, 'default_rate_per_day');
  const hasSalary = Object.prototype.hasOwnProperty.call(body, 'monthly_salary');
  const hasDeduction = Object.prototype.hasOwnProperty.call(body, 'monthly_absence_deduction');
  const touchesPayFields = hasPayType || hasRate || hasSalary || hasDeduction;

  let name;
  let contact;
  let payType;
  let defaultRatePerDay;
  let monthlySalary;
  let monthlyAbsenceDeduction;

  if (hasName) {
    name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'اسم المدرب مطلوب' }, { status: 400 });
    }
  }

  if (hasContact) {
    contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  }

  if (hasActive && typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'قيمة active غير صالحة' }, { status: 400 });
  }

  let deactivationReason = null;
  if (hasActive && body.active === false) {
    deactivationReason = typeof body.deactivation_reason === 'string' ? body.deactivation_reason.trim() : '';
    if (!deactivationReason) {
      return NextResponse.json({ error: 'سبب التعطيل مطلوب' }, { status: 400 });
    }
  }

  if (touchesPayFields) {
    if (!hasPayType || !VALID_PAY_TYPES.includes(body.pay_type)) {
      return NextResponse.json(
        { error: 'لتعديل بيانات الأجر لازم ترسل نوع الدفع مع الحقول المطلوبة له بالكامل' },
        { status: 400 }
      );
    }
    payType = body.pay_type;

    if (payType === 'per_session') {
      defaultRatePerDay = Number(body.default_rate_per_day);
      if (!Number.isFinite(defaultRatePerDay) || defaultRatePerDay <= 0) {
        return NextResponse.json(
          { error: 'لتعديل بيانات الأجر لازم ترسل نوع الدفع مع الحقول المطلوبة له بالكامل' },
          { status: 400 }
        );
      }
      monthlySalary = null;
      monthlyAbsenceDeduction = null;
    } else {
      monthlySalary = Number(body.monthly_salary);
      monthlyAbsenceDeduction = Number(body.monthly_absence_deduction);
      if (
        !Number.isFinite(monthlySalary) || monthlySalary <= 0 ||
        !Number.isFinite(monthlyAbsenceDeduction) || monthlyAbsenceDeduction <= 0
      ) {
        return NextResponse.json(
          { error: 'لتعديل بيانات الأجر لازم ترسل نوع الدفع مع الحقول المطلوبة له بالكامل' },
          { status: 400 }
        );
      }
      defaultRatePerDay = null;
    }
  }

  if (!hasName && !hasContact && !hasActive && !touchesPayFields) {
    return NextResponse.json({ error: 'لا يوجد أي تعديل مطلوب' }, { status: 400 });
  }

  const [existing] = await sql`SELECT id FROM instructors WHERE id = ${instructorId}`;
  if (!existing) {
    return NextResponse.json({ error: 'المدرب غير موجود' }, { status: 404 });
  }

  const [updated] = await sql`
    UPDATE instructors SET
      name = CASE WHEN ${hasName} THEN ${hasName ? name : null} ELSE name END,
      contact = CASE WHEN ${hasContact} THEN ${hasContact ? (contact || null) : null} ELSE contact END,
      pay_type = CASE WHEN ${touchesPayFields} THEN ${touchesPayFields ? payType : null} ELSE pay_type END,
      default_rate_per_day = CASE WHEN ${touchesPayFields} THEN ${touchesPayFields ? defaultRatePerDay : null} ELSE default_rate_per_day END,
      monthly_salary = CASE WHEN ${touchesPayFields} THEN ${touchesPayFields ? monthlySalary : null} ELSE monthly_salary END,
      monthly_absence_deduction = CASE WHEN ${touchesPayFields} THEN ${touchesPayFields ? monthlyAbsenceDeduction : null} ELSE monthly_absence_deduction END,
      active = CASE WHEN ${hasActive} THEN ${hasActive ? body.active : null} ELSE active END,
      deactivation_reason = CASE WHEN ${hasActive} THEN ${deactivationReason} ELSE deactivation_reason END
    WHERE id = ${instructorId}
    RETURNING id
  `;

  return NextResponse.json({ success: true });
}
