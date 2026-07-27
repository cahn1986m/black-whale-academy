import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const freelancerId = Number(params.id);

  const entries = await sql`
    SELECT id, entry_type, amount, balance_after, note, related_session_id, reversed_entry_id, created_at
    FROM freelancer_ledger_entries
    WHERE freelancer_id = ${freelancerId}
    ORDER BY id DESC
  `;

  const [balanceRow] = await sql`
    SELECT current_balance FROM freelancer_balances WHERE freelancer_id = ${freelancerId}
  `;

  return NextResponse.json({
    entries,
    currentBalance: balanceRow?.current_balance ?? 0,
  });
}

export async function POST(request, { params }) {
  const freelancerId = Number(params.id);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const entryType = body.entryType;
  const amount = Number(body.amount);
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const reversedEntryId = body.reversedEntryId != null ? Number(body.reversedEntryId) : null;

  if (entryType !== 'payment' && entryType !== 'reversal') {
    return NextResponse.json({ error: 'نوع الحركة غير صالح' }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: 'المبلغ يجب أن يكون رقماً غير صفري' }, { status: 400 });
  }

  if (entryType === 'reversal' && !Number.isFinite(reversedEntryId)) {
    return NextResponse.json({ error: 'معرّف القيد المُراد عكسه مطلوب' }, { status: 400 });
  }

  if (!note) {
    return NextResponse.json({ error: 'الملاحظة مطلوبة' }, { status: 400 });
  }

  if (entryType === 'reversal') {
    const [originalEntry] = await sql`
      SELECT amount FROM freelancer_ledger_entries
      WHERE id = ${reversedEntryId} AND freelancer_id = ${freelancerId}
    `;

    if (!originalEntry) {
      return NextResponse.json({ error: 'القيد المُراد عكسه غير موجود' }, { status: 400 });
    }

    const expectedAmount = -1 * Number(originalEntry.amount);
    if (amount !== expectedAmount) {
      return NextResponse.json({ error: 'مبلغ العكس يجب أن يساوي عكس المبلغ الأصلي بالضبط' }, { status: 400 });
    }
  }

  try {
    await sql`SELECT add_freelancer_ledger_entry(${freelancerId}, ${entryType}, ${amount}, ${note}, ${reversedEntryId})`;
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err.code === 'P0001') {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
  }
}
