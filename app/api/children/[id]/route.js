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
        medication_details = ${isOnMedication ? medicationDetails : null}
      WHERE id = ${id}
      RETURNING
        id, full_name, photo_base64, qr_token,
        date_of_birth, nationality, gender,
        parent_full_name, relationship_to_child, parent_phone, parent_email, address,
        has_medical_condition, medical_condition_details,
        is_on_medication, medication_details,
        consent_terms_accepted, consent_marketing_photos
    `;

    return NextResponse.json({ child });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
