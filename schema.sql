-- شغّل هذا الملف مرة واحدة داخل Neon SQL Editor لإنشاء الجداول

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT,
  instructor_name TEXT,
  schedule_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_packages (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  session_count INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  -- Weekly session cap used to compute an enrollment's expiry_date
  -- (sessions_total / sessions_per_week, rounded up, from the enrollment/
  -- renewal date). NULL = no time limit for this package (admin fills it
  -- in manually per package; existing packages are not backfilled).
  sessions_per_week INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Safe to re-run on an already-existing database.
ALTER TABLE activity_packages ADD COLUMN IF NOT EXISTS sessions_per_week INTEGER;

CREATE TABLE IF NOT EXISTS children (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  photo_base64 TEXT,
  qr_token TEXT UNIQUE NOT NULL,
  date_of_birth DATE,
  nationality TEXT,
  gender TEXT CHECK (gender IN ('male', 'female')),
  parent_full_name TEXT,
  relationship_to_child TEXT,
  parent_email TEXT,
  address TEXT,
  -- Medical fields are deliberately nullable at the DB level, with NULL
  -- carrying a real, permanent meaning: "never asked / legacy record" —
  -- distinct from an explicit false. "Required" for new registrations is
  -- enforced by the registration form/API only, never as a NOT NULL
  -- constraint here (see the migration block below for the full reasoning
  -- — this was a deliberate decision after finding real production
  -- children with no data for these fields).
  has_medical_condition BOOLEAN,
  medical_condition_details TEXT,
  is_on_medication BOOLEAN,
  medication_details TEXT,
  consent_terms_accepted BOOLEAN,
  consent_terms_accepted_at TIMESTAMPTZ,
  consent_marketing_photos BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT children_medical_condition_details_consistent CHECK (
    (has_medical_condition = true AND medical_condition_details IS NOT NULL)
    OR
    (has_medical_condition = false AND medical_condition_details IS NULL)
    OR
    (has_medical_condition IS NULL)
  ),
  CONSTRAINT children_medication_details_consistent CHECK (
    (is_on_medication = true AND medication_details IS NOT NULL)
    OR
    (is_on_medication = false AND medication_details IS NULL)
    OR
    (is_on_medication IS NULL)
  ),
  CONSTRAINT children_consent_terms_consistent CHECK (
    (consent_terms_accepted = true AND consent_terms_accepted_at IS NOT NULL)
    OR
    (consent_terms_accepted = false AND consent_terms_accepted_at IS NULL)
    OR
    (consent_terms_accepted IS NULL)
  )
);

-- ============================================================
-- Registration form overhaul — safe to re-run on an already-existing
-- database. Renames/adds the columns above for a DB created before this
-- migration existed. Review only. Do NOT run until you're ready to pair
-- it with the Phase 2 code deploy — see the warning below.
--
-- ⚠️ DEPLOYMENT SEQUENCING WARNING: the parent_contact -> parent_phone
-- rename breaks the live /register POST handler (app/api/register/route.js)
-- the instant this runs, since it currently inserts into parent_contact by
-- name. Public parent registration will 500 until the Phase 2 code changes
-- are deployed alongside (or immediately after) this migration.
--
-- Verified against the real production DB before writing this (via
-- information_schema + direct row counts): children has 11 real rows,
-- enrollments has 14, activity_packages has 12. All 11 children already
-- have a non-null, non-empty parent_contact — the rename + NOT NULL below
-- is safe for existing data. Every other new children column is
-- deliberately left nullable — confirmed with the user: for the medical/
-- consent fields specifically, NULL on the 11 existing children means
-- "never asked / legacy data", a materially different and permanently
-- valid state from an explicit false. Defaulting them to false would
-- silently tell staff "this trainee has no allergies" when the truth is
-- nobody ever asked. "Required" for these fields is enforced only at the
-- registration form/API layer for NEW submissions, never as a DB-level
-- NOT NULL constraint forcing a fake backfill value onto real children.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'children' AND column_name = 'parent_contact'
  ) THEN
    ALTER TABLE children RENAME COLUMN parent_contact TO parent_phone;
  END IF;
END $$;
ALTER TABLE children ALTER COLUMN parent_phone SET NOT NULL;

ALTER TABLE children ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE children ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));
ALTER TABLE children ADD COLUMN IF NOT EXISTS parent_full_name TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS relationship_to_child TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS parent_email TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS has_medical_condition BOOLEAN;
ALTER TABLE children ADD COLUMN IF NOT EXISTS medical_condition_details TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS is_on_medication BOOLEAN;
ALTER TABLE children ADD COLUMN IF NOT EXISTS medication_details TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS consent_terms_accepted BOOLEAN;
ALTER TABLE children ADD COLUMN IF NOT EXISTS consent_terms_accepted_at TIMESTAMPTZ;
ALTER TABLE children ADD COLUMN IF NOT EXISTS consent_marketing_photos BOOLEAN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'children' AND constraint_name = 'children_medical_condition_details_consistent'
  ) THEN
    ALTER TABLE children ADD CONSTRAINT children_medical_condition_details_consistent CHECK (
      (has_medical_condition = true AND medical_condition_details IS NOT NULL)
      OR
      (has_medical_condition = false AND medical_condition_details IS NULL)
      OR
      (has_medical_condition IS NULL)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'children' AND constraint_name = 'children_medication_details_consistent'
  ) THEN
    ALTER TABLE children ADD CONSTRAINT children_medication_details_consistent CHECK (
      (is_on_medication = true AND medication_details IS NOT NULL)
      OR
      (is_on_medication = false AND medication_details IS NULL)
      OR
      (is_on_medication IS NULL)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'children' AND constraint_name = 'children_consent_terms_consistent'
  ) THEN
    ALTER TABLE children ADD CONSTRAINT children_consent_terms_consistent CHECK (
      (consent_terms_accepted = true AND consent_terms_accepted_at IS NOT NULL)
      OR
      (consent_terms_accepted = false AND consent_terms_accepted_at IS NULL)
      OR
      (consent_terms_accepted IS NULL)
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  package_id INTEGER REFERENCES activity_packages(id) ON DELETE SET NULL,
  sessions_total INTEGER NOT NULL,
  -- Sessions already used before this child started being tracked by the
  -- app (e.g. paper/manual attendance) — added on top of real scanned
  -- attendance, editable by admin. See app/api/children/[id]/enrollments/route.js.
  sessions_used_offset INTEGER NOT NULL DEFAULT 0,
  price_paid NUMERIC,
  -- Computed at enroll/renewal time from the package's sessions_per_week
  -- (NULL if the package has no weekly cap = no time limit). Not
  -- retroactive: existing enrollments stay NULL until their next renewal.
  expiry_date DATE,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, activity_id)
);

-- Safe to re-run on an already-existing database: adds the column if this
-- table was created before sessions_used_offset existed.
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS sessions_used_offset INTEGER NOT NULL DEFAULT 0;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS expiry_date DATE;

CREATE TABLE IF NOT EXISTS activity_attendance (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  marked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(enrollment_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_activity_packages_activity ON activity_packages(activity_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_child ON enrollments(child_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_activity ON enrollments(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_attendance_date ON activity_attendance(attendance_date);

-- Single shared password for the /admin login gate. Changeable from inside
-- /admin itself (no Vercel env var involved) — see app/api/admin-password/route.js.
CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  password TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT admin_settings_singleton CHECK (id = 1)
);

-- Default password after first running this file: admin123 — log into
-- /admin with it once and change it immediately from the admin page.
INSERT INTO admin_settings (id, password) VALUES (1, 'admin123')
ON CONFLICT (id) DO NOTHING;
