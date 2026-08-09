-- Enrollment approval workflow + special-needs flag + deactivation reasons.
-- Review only. Do NOT run until paired with the matching code deploy (the
-- status default of 'active' keeps existing behavior working immediately,
-- but /register needs its code change deployed alongside this so new
-- public registrations actually land as 'pending_approval' instead of
-- silently defaulting to 'active').
--
-- Verified against the real production DB before writing this (via
-- information_schema + row counts): enrollments has 59 rows, children has
-- 54, instructors has 6, freelancers has 5. All four ALTER blocks below are
-- purely additive (new nullable columns, or a new column with a safe
-- default) — nothing existing is renamed, dropped, or made non-nullable.

-- ============================================================
-- 1. enrollments — approval status
-- ============================================================
-- Every existing row defaults to 'active': all 59 real enrollments today
-- were created directly by the admin (renew/add-enrollment), which this
-- feature treats as auto-approved — so the default preserves their current
-- real-world meaning exactly. New /register submissions explicitly insert
-- 'pending_approval' instead of relying on this default (see
-- app/api/register/route.js) — admin-created enrollments continue to rely
-- on this default (or set it explicitly to 'active', same result).

ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'enrollments' AND constraint_name = 'enrollments_status_check'
  ) THEN
    ALTER TABLE enrollments ADD CONSTRAINT enrollments_status_check
      CHECK (status IN ('pending_approval', 'active', 'cancelled', 'rejected'));
  END IF;
END $$;

-- ============================================================
-- 2. children — special needs flag (admin-only; never shown on the scan
--    page, the manual attendance table, or the printed/downloaded QR badge)
-- ============================================================
-- Same three-state NULL pattern as has_medical_condition/is_on_medication:
-- NULL = never asked (all 54 existing children land here automatically),
-- false = explicitly no, true = requires special_needs_details.

ALTER TABLE children ADD COLUMN IF NOT EXISTS has_special_needs BOOLEAN;
ALTER TABLE children ADD COLUMN IF NOT EXISTS special_needs_details TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'children' AND constraint_name = 'children_special_needs_details_consistent'
  ) THEN
    ALTER TABLE children ADD CONSTRAINT children_special_needs_details_consistent CHECK (
      (has_special_needs = true AND special_needs_details IS NOT NULL)
      OR
      (has_special_needs = false AND special_needs_details IS NULL)
      OR
      (has_special_needs IS NULL)
    );
  END IF;
END $$;

-- ============================================================
-- 3 & 4. instructors / freelancers — deactivation reason
-- ============================================================
-- Nullable at the DB level on purpose — "required" is enforced only at the
-- admin deactivate-account form, matching the has_medical_condition
-- precedent of not forcing a NOT NULL constraint onto data that predates
-- the feature (all currently-active rows, and any row deactivated before
-- this shipped, legitimately have no reason on file).

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
ALTER TABLE freelancers ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
