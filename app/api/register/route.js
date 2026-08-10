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
    const dateOfBirth = (body.dateOfBirth || '').trim();
    const nationality = (body.nationality || '').trim();
    const gender = (body.gender || '').trim();
    const parentFullName = (body.parentFullName || '').trim();
    const relationshipToChild = (body.relationshipToChild || '').trim();
    const parentPhone = (body.parentPhone || '').trim();
    const parentEmail = (body.parentEmail || '').trim();
    const address = (body.address || '').trim() || null;
    const photoBase64 = body.photoBase64 || null;
    const rawSelections = Array.isArray(body.selections) ? body.selections : [];

    const hasMedicalCondition = body.hasMedicalCondition;
    const medicalConditionDetails = (body.medicalConditionDetails || '').trim() || null;
    const isOnMedication = body.isOnMedication;
    const medicationDetails = (body.medicationDetails || '').trim() || null;
    // Not asked by the regular /register form (stays NULL = never asked,
    // same as an admin-created trainee) — only /register/special sends
    // hasSpecialNeeds: true with a required details string.
    const hasSpecialNeeds = typeof body.hasSpecialNeeds === 'boolean' ? body.hasSpecialNeeds : null;
    const specialNeedsDetails = (body.specialNeedsDetails || '').trim() || null;
    const consentTermsAccepted = body.consentTermsAccepted === true;
    const consentMarketingPhotos = body.consentMarketingPhotos === true;

    if (!fullName) {
      return NextResponse.json({ error: 'اسم المتدرب مطلوب' }, { status: 400 });
    }
    if (!dateOfBirth) {
      return NextResponse.json({ error: 'تاريخ ميلاد المتدرب مطلوب' }, { status: 400 });
    }
    if (!nationality) {
      return NextResponse.json({ error: 'الجنسية مطلوبة' }, { status: 400 });
    }
    if (gender !== 'male' && gender !== 'female') {
      return NextResponse.json({ error: 'الجنس مطلوب' }, { status: 400 });
    }
    if (!parentFullName) {
      return NextResponse.json({ error: 'اسم ولي الأمر مطلوب' }, { status: 400 });
    }
    if (!relationshipToChild) {
      return NextResponse.json({ error: 'صلة القرابة مطلوبة' }, { status: 400 });
    }
    if (!parentPhone) {
      return NextResponse.json({ error: 'رقم تواصل ولي الأمر مطلوب' }, { status: 400 });
    }
    if (!parentEmail) {
      return NextResponse.json({ error: 'البريد الإلكتروني لولي الأمر مطلوب' }, { status: 400 });
    }
    if (typeof hasMedicalCondition !== 'boolean') {
      return NextResponse.json({ error: 'الرجاء الإجابة عن سؤال الحالة الصحية' }, { status: 400 });
    }
    if (hasMedicalCondition && !medicalConditionDetails) {
      return NextResponse.json({ error: 'الرجاء ذكر تفاصيل الحالة الصحية' }, { status: 400 });
    }
    if (typeof isOnMedication !== 'boolean') {
      return NextResponse.json({ error: 'الرجاء الإجابة عن سؤال الأدوية' }, { status: 400 });
    }
    if (isOnMedication && !medicationDetails) {
      return NextResponse.json({ error: 'الرجاء ذكر تفاصيل الأدوية' }, { status: 400 });
    }
    if (hasSpecialNeeds && !specialNeedsDetails) {
      return NextResponse.json({ error: 'الرجاء ذكر تفاصيل الاحتياجات الخاصة' }, { status: 400 });
    }
    if (!consentTermsAccepted) {
      return NextResponse.json({ error: 'الموافقة على الشروط والأحكام مطلوبة للمتابعة' }, { status: 400 });
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
          INSERT INTO children (
            full_name, parent_phone, photo_base64, qr_token,
            date_of_birth, nationality, gender,
            parent_full_name, relationship_to_child, parent_email, address,
            has_medical_condition, medical_condition_details,
            is_on_medication, medication_details,
            has_special_needs, special_needs_details,
            consent_terms_accepted, consent_terms_accepted_at, consent_marketing_photos
          )
          VALUES (
            ${fullName}, ${parentPhone}, ${photoBase64}, ${qrToken},
            ${dateOfBirth}, ${nationality}, ${gender},
            ${parentFullName}, ${relationshipToChild}, ${parentEmail}, ${address},
            ${hasMedicalCondition}, ${medicalConditionDetails},
            ${isOnMedication}, ${medicationDetails},
            ${hasSpecialNeeds}, ${specialNeedsDetails},
            ${consentTermsAccepted}, now(), ${consentMarketingPhotos}
          )
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
      // Public submissions always land as pending_approval — an admin has
      // to approve before the trainee can actually attend (see
      // /api/attendance's hard block on non-active status). Not reachable
      // today (this route always inserts a brand-new children row, so
      // child_id can never already have a row for this activity_id) but
      // implemented as an explicit check-then-update rather than relying
      // on ON CONFLICT DO NOTHING, which would silently drop a legitimate
      // re-registration attempt if a future change ever lets this route
      // reuse an existing child_id (e.g. a previously rejected/cancelled
      // enrollment for the same activity must reopen for review, not be
      // silently ignored).
      const [existing] = await sql`
        SELECT id FROM enrollments WHERE child_id = ${child.id} AND activity_id = ${sel.activityId}
      `;
      if (existing) {
        await sql`
          UPDATE enrollments SET
            package_id = ${sel.packageId},
            sessions_total = ${sel.sessionsTotal},
            price_paid = ${sel.price},
            status = 'pending_approval',
            status_reason = NULL,
            status_changed_at = now(),
            expiry_date = NULL
          WHERE id = ${existing.id}
        `;
      } else {
        await sql`
          INSERT INTO enrollments (child_id, activity_id, package_id, sessions_total, price_paid, status, status_changed_at)
          VALUES (${child.id}, ${sel.activityId}, ${sel.packageId}, ${sel.sessionsTotal}, ${sel.price}, 'pending_approval', now())
        `;
      }
    }

    return NextResponse.json({ child });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
