import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyFreelancerSession } from '@/lib/freelancer-session';
import { uaeSessionDateTimeToUtc } from '@/lib/uae-time';

export const dynamic = 'force-dynamic';

const MAX_CHILD_COUNT = 200;

export async function POST(request) {
  const cookie = request.cookies.get('bwa_freelancer_session')?.value;
  const session = cookie ? await verifyFreelancerSession(cookie) : null;

  if (!session) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
  }

  const [freelancer] = await sql`SELECT is_active FROM freelancers WHERE id = ${session.freelancerId}`;

  if (!freelancer || !freelancer.is_active) {
    return NextResponse.json({ error: 'هذا الحساب معطّل، تواصل مع الإدارة' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });
  }

  const sessionDate = typeof body.sessionDate === 'string' ? body.sessionDate : '';
  const sessionTime = typeof body.sessionTime === 'string' ? body.sessionTime : '';
  const levelCounts = body.levelCounts;

  if (!sessionDate || !sessionTime) {
    return NextResponse.json({ error: 'التاريخ والوقت مطلوبان' }, { status: 400 });
  }

  const sessionDateTime = uaeSessionDateTimeToUtc(sessionDate, sessionTime);
  if (!sessionDateTime) {
    return NextResponse.json({ error: 'التاريخ أو الوقت غير صالح' }, { status: 400 });
  }

  if (sessionDateTime.getTime() < Date.now()) {
    return NextResponse.json({ error: 'لا يمكن حجز موعد بالماضي' }, { status: 400 });
  }

  if (!Array.isArray(levelCounts) || levelCounts.length === 0) {
    return NextResponse.json({ error: 'يجب تحديد عدد الأطفال لمستوى واحد على الأقل' }, { status: 400 });
  }

  const normalized = [];
  for (let i = 0; i < levelCounts.length; i++) {
    const item = levelCounts[i];
    const level = typeof item?.level === 'string' ? item.level.trim() : '';
    const count = item?.count;

    if (!level) {
      return NextResponse.json(
        { error: `العنصر رقم ${i + 1}: المستوى مطلوب` },
        { status: 400 }
      );
    }
    if (!Number.isInteger(count) || count <= 0 || count > MAX_CHILD_COUNT) {
      return NextResponse.json(
        { error: `العنصر رقم ${i + 1} (المستوى ${level}): عدد الأطفال يجب أن يكون رقماً صحيحاً موجباً لا يتجاوز ${MAX_CHILD_COUNT}` },
        { status: 400 }
      );
    }

    normalized.push({ level, count });
  }

  const seenLevels = new Set();
  for (const { level } of normalized) {
    if (seenLevels.has(level)) {
      return NextResponse.json({ error: `المستوى ${level} مكرر بالقائمة` }, { status: 400 });
    }
    seenLevels.add(level);
  }

  try {
    const [row] = await sql`
      SELECT create_freelancer_session_request(
        ${session.freelancerId},
        ${sessionDate},
        ${sessionTime},
        ${JSON.stringify(normalized)}::jsonb
      ) AS session_id
    `;
    return NextResponse.json({ success: true, sessionId: row.session_id });
  } catch (err) {
    if (err.code === 'P0001') {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'حدث خطأ غير متوقع، حاول مرة أخرى' }, { status: 500 });
  }
}

export async function GET(request) {
  const cookie = request.cookies.get('bwa_freelancer_session')?.value;
  const session = cookie ? await verifyFreelancerSession(cookie) : null;

  if (!session) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول' }, { status: 401 });
  }

  const [freelancer] = await sql`SELECT is_active FROM freelancers WHERE id = ${session.freelancerId}`;

  if (!freelancer || !freelancer.is_active) {
    return NextResponse.json({ error: 'هذا الحساب معطّل، تواصل مع الإدارة' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');

  const sessions = statusFilter
    ? await sql`
        SELECT id, session_date, session_time, status, closed_at, closed_by, rejected_at, rejection_reason, created_at
        FROM freelancer_sessions
        WHERE freelancer_id = ${session.freelancerId} AND status = ${statusFilter}
        ORDER BY session_date DESC, session_time DESC
      `
    : await sql`
        SELECT id, session_date, session_time, status, closed_at, closed_by, rejected_at, rejection_reason, created_at
        FROM freelancer_sessions
        WHERE freelancer_id = ${session.freelancerId}
        ORDER BY session_date DESC, session_time DESC
      `;

  return NextResponse.json({ sessions });
}
