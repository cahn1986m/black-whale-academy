import { sql } from './db';

function addWeeks(date, weeks) {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

// The "real" weekly session count used for expiry_date math, in priority
// order: an explicit per-enrollment override always wins; otherwise the
// actual count of assigned time slots (if the trainee has any) is more
// accurate than the package's generic number; otherwise fall back to the
// enrolled package's sessions_per_week; otherwise there's no time limit.
async function getEffectiveSessionsPerWeek(enrollmentId) {
  const [row] = await sql`
    SELECT
      e.sessions_per_week_override,
      ap.sessions_per_week AS package_sessions_per_week,
      (SELECT COUNT(*)::int FROM enrollment_slot_assignments WHERE enrollment_id = e.id) AS assigned_slot_count
    FROM enrollments e
    LEFT JOIN activity_packages ap ON ap.id = e.package_id
    WHERE e.id = ${enrollmentId}
  `;
  if (!row) return null;
  if (row.sessions_per_week_override != null) return row.sessions_per_week_override;
  if (row.assigned_slot_count > 0) return row.assigned_slot_count;
  return row.package_sessions_per_week ?? null;
}

// Always recomputes from *today*, based on the remaining balance right
// now (never from the old expiry_date) — matches the pre-existing
// enroll/renew behavior. Call this after anything that could change the
// effective sessions/week: enroll/renew, slot assign/unassign, or the
// override being set/cleared.
export async function recomputeExpiryDate(enrollmentId) {
  const effectiveSessionsPerWeek = await getEffectiveSessionsPerWeek(enrollmentId);

  let expiryDate = null;
  if (effectiveSessionsPerWeek && effectiveSessionsPerWeek > 0) {
    const [enrollment] = await sql`
      SELECT sessions_total, sessions_used_offset FROM enrollments WHERE id = ${enrollmentId}
    `;
    const [usage] = await sql`
      SELECT COUNT(*)::int AS used_count FROM activity_attendance
      WHERE enrollment_id = ${enrollmentId} AND status = 'present'
    `;
    const sessionsUsed = usage.used_count + enrollment.sessions_used_offset;
    const remaining = Math.max(enrollment.sessions_total - sessionsUsed, 0);
    const weeks = Math.ceil(remaining / effectiveSessionsPerWeek);
    expiryDate = addWeeks(new Date(), weeks);
  }

  const [updated] = await sql`
    UPDATE enrollments SET expiry_date = ${expiryDate}
    WHERE id = ${enrollmentId}
    RETURNING id, expiry_date
  `;
  return updated;
}
