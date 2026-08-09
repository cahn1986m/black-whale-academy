import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ageRows = await sql`
      SELECT EXTRACT(YEAR FROM age(date_of_birth))::int AS age, COUNT(*)::int AS count
      FROM children
      WHERE date_of_birth IS NOT NULL
      GROUP BY age
      ORDER BY age ASC
    `;
    const [ageUnknownRow] = await sql`
      SELECT COUNT(*)::int AS count FROM children WHERE date_of_birth IS NULL
    `;

    const genderRows = await sql`
      SELECT COALESCE(gender, 'unknown') AS gender, COUNT(*)::int AS count
      FROM children
      GROUP BY gender
      ORDER BY count DESC
    `;

    const nationalityRows = await sql`
      SELECT COALESCE(nationality, 'unknown') AS nationality, COUNT(*)::int AS count
      FROM children
      GROUP BY nationality
      ORDER BY count DESC
    `;

    const enrollmentsByActivity = await sql`
      SELECT a.id, a.name,
        COUNT(*) FILTER (WHERE e.status = 'active')::int AS active_count,
        COUNT(*) FILTER (WHERE e.status = 'pending_approval')::int AS pending_count
      FROM activities a
      LEFT JOIN enrollments e ON e.activity_id = a.id
      GROUP BY a.id, a.name
      ORDER BY a.name ASC
    `;

    const financialByActivity = await sql`
      SELECT a.id, a.name, COALESCE(SUM(e.price_paid), 0)::numeric AS total
      FROM activities a
      LEFT JOIN enrollments e ON e.activity_id = a.id
      GROUP BY a.id, a.name
      ORDER BY a.name ASC
    `;
    const [totalRevenueRow] = await sql`
      SELECT COALESCE(SUM(price_paid), 0)::numeric AS total FROM enrollments
    `;

    return NextResponse.json({
      ageDistribution: ageRows,
      ageUnknownCount: ageUnknownRow?.count ?? 0,
      genderDistribution: genderRows,
      nationalityDistribution: nationalityRows,
      enrollmentsByActivity,
      financialByActivity,
      totalRevenue: totalRevenueRow?.total ?? 0,
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
