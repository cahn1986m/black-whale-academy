-- Per-slot instructor override: a specific weekly time slot can be taught
-- by someone other than the activity's default instructor (activities.
-- instructor_id). NULL (the default for every existing row) falls back
-- to that default automatically — no data migration needed.
-- Review only. Do NOT run this — Amr runs it himself in the Neon SQL
-- Editor, same pattern as every prior migration this project.
--
-- Verified against the live production DB before writing this (read-only
-- information_schema + row counts): activity_time_slots has 0 rows,
-- instructors has 6 rows, enrollment_slot_assignments has 0 rows.
-- activity_time_slots does not have an instructor_id column yet.

ALTER TABLE activity_time_slots ADD COLUMN IF NOT EXISTS instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activity_time_slots_instructor ON activity_time_slots(instructor_id);
