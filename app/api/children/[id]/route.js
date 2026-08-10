import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const id = Number(params.id);
    const [child] = await sql`
      SELECT
        id, full_name, photo_base64, qr_token,
        date_of_birth, nationality, gender,
        parent_full_name, relationship_to_child, parent_phone, parent_email, address,
        has_medical_condition, medical_condition_details,
        is_on_medication, medication_details,
        has_special_needs, special_needs_details,
        archived_at, archived_reason,
        consent_terms_accepted, consent_marketing_photos
      FROM children WHERE id = ${id}
    `;
    if (!child) {
      return NextResponse.json({ error: 'المتدرب غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ child }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const id = Number(params.id);
    const body = await request.json().catch(() => ({}));

    // Archive/restore are distinct intents from the general profile edit
    // below, keyed on which field the body carries (same pattern as the
    // enrollments PATCH route's cancelReason/sessionsUsedOffset split).
    // Archiving is child-level, not per-enrollment — it blocks attendance
    // for ALL of this child's enrollments regardless of their individual
    // status, with its own distinct message (see /api/attendance).
    if (body.archiveReason !== undefined) {
      const archiveReason = (body.archiveReason || '').trim();
      if (!archiveReason) {
        return NextResponse.json({ error: 'سبب الأرشفة مطلوب' }, { status: 400 });
      }
      const [child] = await sql`
        UPDATE children SET archived_at = now(), archived_reason = ${archiveReason}
        WHERE id = ${id}
        RETURNING id, archived_at, archived_reason
      `;
      if (!child) {
        return NextResponse.json({ error: 'المتدرب غير موجود' }, { status: 404 });
      }
      return NextResponse.json({ child });
    }

    if (body.unarchive === true) {
      const [child] = await sql`
        UPDATE children SET archived_at = NULL, archived_reason = NULL
        WHERE id = ${id}
        RETURNING id, archived_at, archived_reason
      `;
      if (!child) {
        return NextResponse.json({ error: 'المتدرب غير موجود' }, { status: 404 });
      }
      return NextResponse.json({ child });
    }

    const fullName = (body.fullName || '').trim();
    const dateOfBirth = body.dateOfBirth || null;
    const nationality = (body.nationality || '').trim() || null;
    const gender = body.gender || null;
    const parentFullName = (body.parentFullName || '').trim() || null;
    const relationshipToChild = (body.relationshipToChild || '').trim() || null;
    const parentPhone = (body.parentPhone || '').trim();
    const parentEmail = (body.parentEmail || '').trim() || null;
    const address = (body.address || '').trim() || null;

    const hasMedicalCondition = typeof body.hasMedicalCondition === 'boolean' ? body.hasMedicalCondition : null;
    const medicalConditionDetails = (body.medicalConditionDetails || '').trim() || null;
    const isOnMedication = typeof body.isOnMedication === 'boolean' ? body.isOnMedication : null;
    const medicationDetails = (body.medicationDetails || '').trim() || null;

    // Admin-only field — deliberately never surfaced on the scan page, the
    // manual attendance table, or the QR badge (see the schema migration
    // notes). Same conditional-details pattern as the medical fields.
    const hasSpecialNeeds = typeof body.hasSpecialNeeds === 'boolean' ? body.hasSpecialNeeds : null;
    const specialNeedsDetails = (body.specialNeedsDetails || '').trim() || null;

    if (!fullName) {
      return NextResponse.json({ error: 'اسم المتدرب مطلوب' }, { status: 400 });
    }
    if (!parentPhone) {
      return NextResponse.json({ error: 'رقم تواصل ولي الأمر مطلوب' }, { status: 400 });
    }
    if (hasMedicalCondition && !medicalConditionDetails) {
      return NextResponse.json({ error: 'الرجاء ذكر تفاصيل الحالة الصحية' }, { status: 400 });
    }
    if (isOnMedication && !medicationDetails) {
      return NextResponse.json({ error: 'الرجاء ذكر تفاصيل الأدوية' }, { status: 400 });
    }
    if (hasSpecialNeeds && !specialNeedsDetails) {
      return NextResponse.json({ error: 'الرجاء ذكر تفاصيل الاحتياجات الخاصة' }, { status: 400 });
    }

    const [existing] = await sql`SELECT id FROM children WHERE id = ${id}`;
    if (!existing) {
      return NextResponse.json({ error: 'المتدرب غير موجود' }, { status: 404 });
    }

    const [child] = await sql`
      UPDATE children SET
        full_name = ${fullName},
        date_of_birth = ${dateOfBirth},
        nationality = ${nationality},
        gender = ${gender},
        parent_full_name = ${parentFullName},
        relationship_to_child = ${relationshipToChild},
        parent_phone = ${parentPhone},
        parent_email = ${parentEmail},
        address = ${address},
        has_medical_condition = ${hasMedicalCondition},
        medical_condition_details = ${hasMedicalCondition ? medicalConditionDetails : null},
        is_on_medication = ${isOnMedication},
        medication_details = ${isOnMedication ? medicationDetails : null},
        has_special_needs = ${hasSpecialNeeds},
        special_needs_details = ${hasSpecialNeeds ? specialNeedsDetails : null}
      WHERE id = ${id}
      RETURNING
        id, full_name, photo_base64, qr_token,
        date_of_birth, nationality, gender,
        parent_full_name, relationship_to_child, parent_phone, parent_email, address,
        has_medical_condition, medical_condition_details,
        is_on_medication, medication_details,
        has_special_needs, special_needs_details,
        archived_at, archived_reason,
        consent_terms_accepted, consent_marketing_photos
    `;

    return NextResponse.json({ child });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
