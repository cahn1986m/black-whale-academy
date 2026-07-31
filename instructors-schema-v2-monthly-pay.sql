-- Instructors module v2 — flexible pay_type (per_session/monthly) +
-- shift-based attendance (one row per instructor per day, not per
-- activity). Additive/destructive-but-safe ALTER set on top of
-- instructors-schema.sql (already live). Safe against the 4 real rows
-- currently in `instructors` and the 0 rows in instructor_attendance /
-- instructor_ledger_entries (verified via information_schema before
-- writing this). Review only. Do NOT run until approved.

-- ============================================================
-- 1. instructors — rename rate column, add pay_type + monthly fields
-- ============================================================

ALTER TABLE instructors RENAME COLUMN default_rate_per_session TO default_rate_per_day;
ALTER TABLE instructors ALTER COLUMN default_rate_per_day DROP NOT NULL;

-- pay_type defaults every existing row (including the 4 real ones) to
-- 'per_session' automatically — no manual backfill needed.
ALTER TABLE instructors ADD COLUMN pay_type TEXT NOT NULL DEFAULT 'per_session'
  CHECK (pay_type IN ('per_session', 'monthly'));

ALTER TABLE instructors ADD COLUMN monthly_salary NUMERIC(10,2);
ALTER TABLE instructors ADD COLUMN monthly_absence_deduction NUMERIC(10,2);

-- Enforces exactly the right fields are set per pay_type — an
-- instructor can't be per_session without a day rate, or monthly
-- without both salary and deduction amount configured.
ALTER TABLE instructors ADD CONSTRAINT instructors_pay_type_fields_consistent CHECK (
  (pay_type = 'per_session' AND default_rate_per_day IS NOT NULL AND monthly_salary IS NULL AND monthly_absence_deduction IS NULL)
  OR
  (pay_type = 'monthly' AND default_rate_per_day IS NULL AND monthly_salary IS NOT NULL AND monthly_absence_deduction IS NOT NULL)
);

-- ============================================================
-- 2. instructor_attendance — shift-based (one row per day, not per activity)
-- ============================================================

ALTER TABLE instructor_attendance DROP CONSTRAINT instructor_attendance_activity_id_fkey;
DROP INDEX IF EXISTS idx_instructor_attendance_activity;
ALTER TABLE instructor_attendance DROP CONSTRAINT instructor_attendance_instructor_id_activity_id_attendance_key;
ALTER TABLE instructor_attendance DROP COLUMN activity_id;

ALTER TABLE instructor_attendance ADD CONSTRAINT instructor_attendance_instructor_id_attendance_date_key
  UNIQUE (instructor_id, attendance_date);

-- ============================================================
-- 3. instructor_ledger_entries — new entry types
-- ============================================================

ALTER TABLE instructor_ledger_entries DROP CONSTRAINT instructor_ledger_entries_entry_type_check;
ALTER TABLE instructor_ledger_entries ADD CONSTRAINT instructor_ledger_entries_entry_type_check
  CHECK (entry_type IN ('payment', 'session_pay', 'reversal', 'monthly_salary', 'deduction'));

ALTER TABLE instructor_ledger_entries DROP CONSTRAINT instructor_ledger_entries_related_attendance_consistent;
ALTER TABLE instructor_ledger_entries ADD CONSTRAINT instructor_ledger_entries_related_attendance_consistent CHECK (
  (entry_type IN ('session_pay', 'deduction') AND related_attendance_id IS NOT NULL)
  OR
  (entry_type IN ('payment', 'monthly_salary') AND related_attendance_id IS NULL)
  OR
  (entry_type = 'reversal')
);

-- ============================================================
-- 4. record_instructor_attendance() — rewritten: no activity_id,
--    branches on instructors.pay_type
-- ============================================================

DROP FUNCTION IF EXISTS record_instructor_attendance(INTEGER, INTEGER, DATE, TEXT);

CREATE OR REPLACE FUNCTION record_instructor_attendance(
  p_instructor_id INTEGER,
  p_attendance_date DATE,
  p_status TEXT
) RETURNS void AS $$
DECLARE
  v_attendance_id INTEGER;
  v_previous_status TEXT;
  v_pay_type TEXT;
  v_rate NUMERIC(10,2);
  v_deduction NUMERIC(10,2);
  v_current_balance NUMERIC(10,2);
  v_existing_entry RECORD;
BEGIN
  IF p_status NOT IN ('present', 'absent') THEN
    RAISE EXCEPTION 'invalid status: %', p_status;
  END IF;

  SELECT pay_type, default_rate_per_day, monthly_absence_deduction
  INTO v_pay_type, v_rate, v_deduction
  FROM instructors WHERE id = p_instructor_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'instructor % not found', p_instructor_id;
  END IF;

  SELECT status INTO v_previous_status
  FROM instructor_attendance
  WHERE instructor_id = p_instructor_id AND attendance_date = p_attendance_date
  FOR UPDATE;

  INSERT INTO instructor_attendance (instructor_id, attendance_date, status)
  VALUES (p_instructor_id, p_attendance_date, p_status)
  ON CONFLICT (instructor_id, attendance_date)
  DO UPDATE SET status = EXCLUDED.status
  RETURNING id INTO v_attendance_id;

  IF v_previous_status IS NOT DISTINCT FROM p_status THEN
    RETURN;
  END IF;

  v_current_balance := COALESCE(
    (SELECT balance_after FROM instructor_ledger_entries
     WHERE instructor_id = p_instructor_id ORDER BY id DESC LIMIT 1),
    0
  );

  IF v_pay_type = 'per_session' THEN
    IF p_status = 'present' THEN
      IF v_rate IS NULL THEN
        RAISE EXCEPTION 'no default_rate_per_day configured for instructor %', p_instructor_id;
      END IF;

      v_current_balance := v_current_balance + v_rate;

      INSERT INTO instructor_ledger_entries
        (instructor_id, entry_type, amount, balance_after, note, related_attendance_id)
      VALUES
        (p_instructor_id, 'session_pay', v_rate, v_current_balance, 'حضور يوم', v_attendance_id);
    ELSE
      SELECT ile.* INTO v_existing_entry
      FROM instructor_ledger_entries ile
      WHERE ile.related_attendance_id = v_attendance_id AND ile.entry_type = 'session_pay'
        AND NOT EXISTS (SELECT 1 FROM instructor_ledger_entries r WHERE r.reversed_entry_id = ile.id)
      LIMIT 1;

      IF FOUND THEN
        v_current_balance := v_current_balance - v_existing_entry.amount;
        INSERT INTO instructor_ledger_entries
          (instructor_id, entry_type, amount, balance_after, note, reversed_entry_id)
        VALUES
          (p_instructor_id, 'reversal', -1 * v_existing_entry.amount, v_current_balance,
           'تصحيح: تعديل الحضور من حاضر إلى غايب', v_existing_entry.id);
      END IF;
    END IF;
  ELSE
    IF p_status = 'absent' THEN
      IF v_deduction IS NULL THEN
        RAISE EXCEPTION 'no monthly_absence_deduction configured for instructor %', p_instructor_id;
      END IF;

      v_current_balance := v_current_balance - v_deduction;

      INSERT INTO instructor_ledger_entries
        (instructor_id, entry_type, amount, balance_after, note, related_attendance_id)
      VALUES
        (p_instructor_id, 'deduction', -1 * v_deduction, v_current_balance, 'خصم غياب', v_attendance_id);
    ELSE
      SELECT ile.* INTO v_existing_entry
      FROM instructor_ledger_entries ile
      WHERE ile.related_attendance_id = v_attendance_id AND ile.entry_type = 'deduction'
        AND NOT EXISTS (SELECT 1 FROM instructor_ledger_entries r WHERE r.reversed_entry_id = ile.id)
      LIMIT 1;

      IF FOUND THEN
        v_current_balance := v_current_balance - v_existing_entry.amount;
        INSERT INTO instructor_ledger_entries
          (instructor_id, entry_type, amount, balance_after, note, reversed_entry_id)
        VALUES
          (p_instructor_id, 'reversal', -1 * v_existing_entry.amount, v_current_balance,
           'تصحيح: تعديل الحضور من غايب إلى حاضر', v_existing_entry.id);
      END IF;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. issue_monthly_salary() — manual, button-triggered
-- ============================================================

CREATE OR REPLACE FUNCTION issue_monthly_salary(p_instructor_id INTEGER) RETURNS void AS $$
DECLARE
  v_pay_type TEXT;
  v_salary NUMERIC(10,2);
  v_current_balance NUMERIC(10,2);
  v_already_issued BOOLEAN;
BEGIN
  SELECT pay_type, monthly_salary INTO v_pay_type, v_salary
  FROM instructors WHERE id = p_instructor_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'instructor % not found', p_instructor_id;
  END IF;

  IF v_pay_type != 'monthly' THEN
    RAISE EXCEPTION 'instructor % is not on a monthly pay_type', p_instructor_id;
  END IF;

  IF v_salary IS NULL THEN
    RAISE EXCEPTION 'no monthly_salary configured for instructor %', p_instructor_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM instructor_ledger_entries
    WHERE instructor_id = p_instructor_id
      AND entry_type = 'monthly_salary'
      AND date_trunc('month', created_at) = date_trunc('month', now())
  ) INTO v_already_issued;

  IF v_already_issued THEN
    RAISE EXCEPTION 'monthly salary already issued for instructor % this month', p_instructor_id;
  END IF;

  v_current_balance := COALESCE(
    (SELECT balance_after FROM instructor_ledger_entries
     WHERE instructor_id = p_instructor_id ORDER BY id DESC LIMIT 1),
    0
  );
  v_current_balance := v_current_balance + v_salary;

  INSERT INTO instructor_ledger_entries
    (instructor_id, entry_type, amount, balance_after, note)
  VALUES
    (p_instructor_id, 'monthly_salary', v_salary, v_current_balance, 'راتب شهر ' || to_char(now(), 'YYYY-MM'));
END;
$$ LANGUAGE plpgsql;
