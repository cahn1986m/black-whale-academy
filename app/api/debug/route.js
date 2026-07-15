import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // نفس استعلام /api/children بالضبط
    const sameAsChildren = await sql`
      SELECT id, full_name, parent_contact, group_id, photo_base64, qr_token
      FROM children
      ORDER BY full_name ASC
    `;

    // استعلام بسيط بدون photo_base64 وبدون ORDER BY على full_name
    const simple = await sql`
      SELECT id, full_name FROM children ORDER BY id
    `;

    // نفس استعلام children بس بدون photo_base64
    const noPhoto = await sql`
      SELECT id, full_name, parent_contact, group_id, qr_token
      FROM children
      ORDER BY full_name ASC
    `;

    // نفس استعلام children مع photo_base64 بس ORDER BY id
    const withPhotoOrderById = await sql`
      SELECT id, full_name, photo_base64
      FROM children
      ORDER BY id ASC
    `;

    return NextResponse.json({
      sameAsChildren_count: sameAsChildren.length,
      sameAsChildren_ids: sameAsChildren.map(r => r.id),
      simple_count: simple.length,
      simple_ids: simple.map(r => r.id),
      noPhoto_count: noPhoto.length,
      noPhoto_ids: noPhoto.map(r => r.id),
      withPhotoOrderById_count: withPhotoOrderById.length,
      withPhotoOrderById_ids: withPhotoOrderById.map(r => r.id),
      photoSizes: withPhotoOrderById.map(r => ({ id: r.id, photoLength: r.photo_base64 ? r.photo_base64.length : 0 })),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (err) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
