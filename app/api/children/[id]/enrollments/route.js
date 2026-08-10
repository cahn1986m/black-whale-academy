import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { recomputeExpiryDate } from '@/lib/expiryDate';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const childId = Number(params.id);

    const enrollments = await sql`
      SELECT e.id, e.activity_id, a.name AS activity_name, a.emoji,
        e.sessions_total, e.price_paid, e.sessions_used_offset, e.expiry_date,
        e.sessions_per_week_override,
        e.status, e.status_reason, e.status_changed_at,
        (e.expiry_date IS NOT NULL AND e.expiry_date < CURRENT_DATE) AS date_expired,
        COALESCE(u.used_count, 0) + e.sessions_used_offset AS sessions_used,
        e.sessions_total - COALESCE(u.used_count, 0) - e.sessions_used_offset AS sessions_remaining
      FROM enrollments e
      JOIN activities a ON a.id = e.activity_id
      LEFT JOIN (
        SELECT enrollment_id, COUNT(*)::int AS used_count
        FROM activity_attendance
        WHERE status = 'present'
        GROUP BY enrollment_id
      ) u ON u.enrollment_id = e.id
      WHERE e.child_id = ${childId}
      ORDER BY a.name ASC
    `;

    return NextResponse.json({ enrollments }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const childId = Number(params.id);
    const body = await request.json().catch(() => ({}));
    const activityId = Number(body.activityId);

    if (!activityId) {
      return NextResponse.json({ error: 'النشاط مطلوب' }, { status: 400 });
    }

    const [child] = await sql`SELECT id FROM children WHERE id = ${childId}`;
    if (!child) {
      return NextResponse.json({ error: 'المتدرب غير موجود' }, { status: 404 });
    }
    const [activity] = await sql`SELECT id FROM activities WHERE id = ${activityId}`;
    if (!activity) {
      return NextResponse.json({ error: 'النشاط غير موجود' }, { status: 404 });
    }

    let packageId = null;
    let sessionsTotal;
    let pricePaid;

    if (body.packageId) {
      const [pkg] = await sql`
        SELECT id, session_count, price, sessions_per_week FROM activity_packages
        WHERE id = ${Number(body.packageId)} AND activity_id = ${activityId}
      `;
      if (!pkg) {
        return NextResponse.json({ error: 'الباقة غير صحيحة' }, { status: 400 });
      }
      packageId = pkg.id;
      sessionsTotal = pkg.session_count;
      pricePaid = pkg.price;
    } else {
      sessionsTotal = Number(body.sessionsTotal);
      if (!sessionsTotal || sessionsTotal <= 0) {
        return NextResponse.json({ error: 'عدد الحصص مطلوب' }, { status: 400 });
      }
      pricePaid = body.pricePaid !== undefined && body.pricePaid !== null && body.pricePaid !== ''
        ? Number(body.pricePaid)
        : null;
    }

    // Admin-created/renewed enrollments are always active immediately —
    // the admin is already trusted, no self-approval loop needed. This
    // also reactivates an enrollment that was previously pending_approval,
    // cancelled, or rejected (the UNIQUE(child_id, activity_id) constraint
    // means a renew on an old activity hits this same UPDATE branch).
    const [enrollment] = await sql`
      INSERT INTO enrollments (child_id, activity_id, package_id, sessions_total, price_paid, status, status_changed_at)
      VALUES (${childId}, ${activityId}, ${packageId}, ${sessionsTotal}, ${pricePaid}, 'active', now())
      ON CONFLICT (child_id, activity_id) DO UPDATE SET
        package_id = EXCLUDED.package_id,
        sessions_total = enrollments.sessions_total + EXCLUDED.sessions_total,
        price_paid = COALESCE(enrollments.price_paid, 0) + COALESCE(EXCLUDED.price_paid, 0),
        status = 'active',
        status_reason = NULL,
        status_changed_at = now()
      RETURNING id, child_id, activity_id, sessions_total, price_paid, sessions_used_offset
    `;

    // Expiry is always recomputed from *this* transaction's date (never from
    // the old expiry_date), based on the remaining balance right after this
    // enroll/renewal, using the effective sessions/week (override > actual
    // assigned slots > package default — see lib/expiryDate.js).
    const updated = await recomputeExpiryDate(enrollment.id);

    return NextResponse.json({ enrollment: { ...enrollment, expiry_date: updated.expiry_date } });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const childId = Number(params.id);
    const body = await request.json().catch(() => ({}));
    const activityId = Number(body.activityId);

    if (!activityId) {
      return NextResponse.json({ error: 'النشاط مطلوب' }, { status: 400 });
    }

    // Three distinct intents share this endpoint, keyed on which field the
    // body carries — the manual-attendance-offset editor, the soft-cancel-
    // with-reason action, and the sessions/week override (each recomputes
    // expiry_date immediately since it changes the effective weekly count).
    if (body.sessionsPerWeekOverride !== undefined) {
      const raw = body.sessionsPerWeekOverride;
      const override = raw === null || raw === '' ? null : Number(raw);
      if (override !== null && (!Number.isInteger(override) || override <= 0)) {
        return NextResponse.json({ error: 'عدد الحصص الأسبوعية غير صحيح' }, { status: 400 });
      }

      const [enrollment] = await sql`
        UPDATE enrollments SET sessions_per_week_override = ${override}
        WHERE child_id = ${childId} AND activity_id = ${activityId}
        RETURNING id
      `;
      if (!enrollment) {
        return NextResponse.json({ error: 'الاشتراك غير موجود' }, { status: 404 });
      }

      const updated = await recomputeExpiryDate(enrollment.id);
      return NextResponse.json({ enrollment: updated });
    }

    if (body.cancelReason !== undefined) {
      const cancelReason = (body.cancelReason || '').trim();
      if (!cancelReason) {
        return NextResponse.json({ error: 'سبب الإلغاء مطلوب' }, { status: 400 });
      }

      const [enrollment] = await sql`
        UPDATE enrollments SET
          status = 'cancelled',
          status_reason = ${cancelReason},
          status_changed_at = now()
        WHERE child_id = ${childId} AND activity_id = ${activityId}
        RETURNING id, child_id, activity_id, status, status_reason
      `;

      if (!enrollment) {
        return NextResponse.json({ error: 'الاشتراك غير موجود' }, { status: 404 });
      }

      return NextResponse.json({ enrollment });
    }

    const sessionsUsedOffset = Number(body.sessionsUsedOffset);
    if (Number.isNaN(sessionsUsedOffset) || sessionsUsedOffset < 0) {
      return NextResponse.json({ error: 'عدد الحصص اليدوية غير صحيح' }, { status: 400 });
    }

    const [enrollment] = await sql`
      UPDATE enrollments SET sessions_used_offset = ${sessionsUsedOffset}
      WHERE child_id = ${childId} AND activity_id = ${activityId}
      RETURNING id, child_id, activity_id, sessions_used_offset
    `;

    if (!enrollment) {
      return NextResponse.json({ error: 'الاشتراك غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ enrollment });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const childId = Number(params.id);
    const { searchParams } = new URL(request.url);
    const activityId = Number(searchParams.get('activityId'));

    if (!activityId) {
      return NextResponse.json({ error: 'النشاط مطلوب' }, { status: 400 });
    }

    const [deleted] = await sql`
      DELETE FROM enrollments WHERE child_id = ${childId} AND activity_id = ${activityId}
      RETURNING id
    `;

    if (!deleted) {
      return NextResponse.json({ error: 'الاشتراك غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
