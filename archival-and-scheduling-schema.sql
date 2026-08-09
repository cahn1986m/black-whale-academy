-- Trainee archive/restore, weekly recurring time slots per activity,
-- per-enrollment slot assignment, and a per-enrollment override for the
-- "real" weekly session count used in expiry_date math.
-- Review only. Do NOT run this — Amr runs it himself in the Neon SQL
-- Editor, same pattern as every prior migration this project.
--
-- Verified against the live production DB before writing this (read-only
-- information_schema + row counts): children has 60 rows, enrollments 65,
-- activities 11. None of the columns/tables below exist yet.
--
-- CHECK expressions verified directly against Postgres before writing
-- (SELECT-only, no schema/data touched):
--   TIME '16:00' + INTERVAL '1 hour' = TIME '17:00'  -> true
--   date_part('minute', TIME '16:00') = 0            -> true
-- Caveat (not a blocker, just documented): TIME + INTERVAL wraps at
-- midnight (e.g. 23:30 + 1h = 00:30), so the end_time CHECK below would
-- technically accept a slot starting at 23:30. Real business hours (see
-- lib/businessHours.js) never get near midnight, and that boundary is
-- enforced at the form/API layer per Amr's explicit instruction (policy,
-- not a DB constraint — see the day_of_week/start_time CHECKs below,
-- which intentionally do NOT encode business hours themselves).

-- 1. children — archive/restore (soft-disable, distinct from enrollment
--    status: archiving a child blocks attendance for ALL their
--    enrollments regardless of individual enrollment status, with its own
--    distinct block message — see app/api/attendance/route.js).
ALTER TABLE children ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE children ADD COLUMN IF NOT EXISTS archived_reason TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'children' AND constraint_name = 'children_archived_consistent'
  ) THEN
    ALTER TABLE children ADD CONSTRAINT children_archived_consistent CHECK (
      (archived_at IS NOT NULL AND archived_reason IS NOT NULL)
      OR
      (archived_at IS NULL AND archived_reason IS NULL)
    );
  END IF;
END $$;

-- 2. activity_time_slots — weekly recurring 1-hour slots per activity.
--    Deliberately no business-hours CHECK here (policy, can change
--    without a migration) — only structural rules: exactly 1 hour long,
--    starts on the hour, no duplicate (activity, day, start_time).
CREATE TABLE IF NOT EXISTS activity_time_slots (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('sunday','monday','tuesday','wednesday','thursday','friday','saturday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(activity_id, day_of_week, start_time),
  CHECK (end_time = start_time + interval '1 hour'),
  CHECK (date_part('minute', start_time) = 0 AND date_part('second', start_time) = 0)
);
CREATE INDEX IF NOT EXISTS idx_activity_time_slots_activity ON activity_time_slots(activity_id);

-- 3. enrollment_slot_assignments — which slot(s) a specific enrollment
--    attends. Many-to-many (an enrollment can be assigned several slots
--    per week; a slot can hold several enrollments).
CREATE TABLE IF NOT EXISTS enrollment_slot_assignments (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  slot_id INTEGER NOT NULL REFERENCES activity_time_slots(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(enrollment_id, slot_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollment_slot_assignments_enrollment ON enrollment_slot_assignments(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_slot_assignments_slot ON enrollment_slot_assignments(slot_id);

-- 4. enrollments — manual override for the real weekly session count used
--    in expiry_date math. Priority order (see lib/expiryDate.js):
--    sessions_per_week_override, if set, wins outright; otherwise the
--    COUNT of this enrollment's assigned slots is used if > 0 (the
--    "actual" schedule); otherwise falls back to the enrolled package's
--    sessions_per_week (pre-existing behavior); otherwise no time limit.
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS sessions_per_week_override INTEGER;
