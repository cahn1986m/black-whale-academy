import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const children = await sql`
      SELECT
        id, full_name, photo_base64, qr_token,
        date_of_birth, nationality, gender,
        parent_full_name, relationship_to_child, parent_phone, parent_email, address,
        has_medical_condition, medical_condition_details,
        is_on_medication, medication_details,
        has_special_needs, special_needs_details,
        consent_terms_accepted, consent_marketing_photos
      FROM children
      ORDER BY id ASC
    `;

    return NextResponse.json({ children }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0',
        'Pragma': 'no-cache',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
