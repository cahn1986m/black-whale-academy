import { NextResponse } from 'next/server';
import { customAlphabet } from 'nanoid';
import { sql } from '@/lib/db';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);
const MAX_TOKEN_ATTEMPTS = 5;

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const fullName = (body.fullName || '').trim();
    const parentContact = (body.parentContact || '').trim();
    const photoBase64 = body.photoBase64 || null;
    const rawSelections = Array.isArray(body.selections) ? body.selections : [];

    if (!fullName) {
      return NextResponse.json({ error: 'اسم الطفل مطلوب' }, { status: 400 });
    }

    // Dedupe by activityId (keep the first package pick per activity).
    const selectionsByActivity = new Map();
    for (const sel of rawSelections) {
      const activityId = Number(sel?.activityId);
      const packageId = Number(sel?.packageId);
      if (!activityId || !packageId) continue;
      if (!selectionsByActivity.has(activityId)) {
        selectionsByActivity.set(activityId, packageId);
      }
    }

    // Validate every packageId actually belongs to its paired activityId.
    const validSelections = [];
    for (const [activityId, packageId] of selectionsByActivity) {
      const [pkg] = await sql`
        SELECT id, session_count, price FROM activity_packages
        WHERE id = ${packageId} AND activity_id = ${activityId}
      `;
      if (!pkg) {
        return NextResponse.json({ error: 'إحدى الباقات المختارة غير صحيحة' }, { status: 400 });
      }
      validSelections.push({ activityId, packageId: pkg.id, sessionsTotal: pkg.session_count, price: pkg.price });
    }

    let child;
    for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt++) {
      const qrToken = nanoid();
      try {
        [child] = await sql`
          INSERT INTO children (full_name, parent_contact, photo_base64, qr_token)
          VALUES (${fullName}, ${parentContact || null}, ${photoBase64}, ${qrToken})
          RETURNING id, full_name, qr_token
        `;
        break;
      } catch (err) {
        if (err.code === '23505' && attempt < MAX_TOKEN_ATTEMPTS - 1) {
          continue;
        }
        throw err;
      }
    }

    if (!child) {
      return NextResponse.json({ error: 'ما قدرنا نولّد كود فريد، حاول مرة تانية' }, { status: 500 });
    }

    for (const sel of validSelections) {
      await sql`
        INSERT INTO enrollments (child_id, activity_id, package_id, sessions_total, price_paid)
        VALUES (${child.id}, ${sel.activityId}, ${sel.packageId}, ${sel.sessionsTotal}, ${sel.price})
        ON CONFLICT (child_id, activity_id) DO NOTHING
      `;
    }

    return NextResponse.json({ child });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
