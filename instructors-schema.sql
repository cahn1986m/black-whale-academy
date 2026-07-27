-- Instructors module — NEW tables + one ALTER only, completely
-- additive except for the single instructor_id column added to the
-- existing activities table. Does not alter/reference-modify any
-- other existing table in schema.sql, and does not touch anything in
-- freelancers-schema.sql or its companion function files (this is a
-- fully separate module from Freelancers — instructors are paid BY
-- the academy for teaching its own activities; freelancers rent pool
-- time and pay the academy — opposite financial direction, see the
-- sign-convention note on instructor_ledger_entries below).
-- Executed and live on production DB as of 2026-07-27.
--
-- IMPORTANT — the record_instructor_attendance() correction/idempotency
-- logic below (how it behaves when called twice, or when correcting a
-- mistaken present/absent mark) is MY interpretation, not something
-- explicitly specified. It reuses the exact reversal pattern already
-- reviewed and shipped for freelancer_ledger_entries
-- (add_freelancer_ledger_entry's 'reversal' entry_type), applied here
-- automatically instead of via a separate manual call. If this isn't
-- the correction behavior you had in mind, say so and I'll redo it —
-- see the comment directly above the function body for the exact
-- rules it implements.

-- ============================================================
-- 1. Instructors
-- ============================================================

CREATE TABLE IF NOT EXISTS instructors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  -- NOT NULL: record_instructor_attendance() needs a rate to pay
  -- against every time it marks someone present, so an instructor
  -- can't be created without one (fail fast at creation, not at the
  -- first attendance scan).
  default_rate_per_session NUMERIC(10,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
  -- Deliberately NO balance column, same reasoning as freelancers:
  -- current balance is always derived as SUM(amount) over
  -- instructor_ledger_entries (see instructor_balances view below),
  -- never stored as a directly-editable field.
);

-- ============================================================
-- 2. Link activities to instructors (ALTER on an existing table)
-- ============================================================

-- instructor_name (free text) is left in place on purpose — this is
-- an additive column, not a migration. Once the manual migration of
-- existing instructor_name values into real instructors rows happens
-- and is confirmed correct, dropping instructor_name is a separate,
-- deliberate follow-up decision — not part of this file.
--
-- ON DELETE SET NULL (not RESTRICT): this column is just "who
-- currently teaches this activity," not a historical/financial
-- record — deleting an instructor should not be blocked just because
-- they're presently assigned somewhere. Their actual attendance/pay
-- history lives in instructor_attendance and instructor_ledger_entries
-- below, which DO use RESTRICT on instructor_id (see those tables).
ALTER TABLE activities ADD COLUMN IF NOT EXISTS instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_instructor_id ON activities(instructor_id);

-- ============================================================
-- 3. Instructor attendance
-- ============================================================

-- Mirrors activity_attendance's shape (schema.sql), but keyed on the
-- (instructor, activity, date) triple instead of (enrollment, date),
-- since one instructor can teach several activities and needs an
-- independent attendance row per activity per day — same reasoning
-- CLAUDE.md documents for why a child's attendance is tracked
-- per-activity rather than per-child-per-day.
--
-- instructor_id: ON DELETE RESTRICT — an instructor with any
-- attendance history can't be deleted outright (same "history is
-- never deletable outright" rule used throughout freelancers-schema.sql).
--
-- activity_id: ON DELETE RESTRICT — deliberately NOT the same as
-- activity_attendance's cascade-on-activity-delete behavior in
-- schema.sql. A child's attendance row is just an operational record;
-- an instructor's attendance row is tied to a financial obligation
-- (a session_pay ledger entry paying real wages). Letting an activity
-- delete quietly cascade into removing rows that a paycheck was
-- computed from would sever that link in a way that's much harder to
-- justify than losing a child's attendance history. So: an activity
-- with any instructor attendance on file can't be deleted outright —
-- same "history is never deletable outright" principle as everywhere
-- else in this file, just applied to activity_id here instead of
-- instructor_id.
CREATE TABLE IF NOT EXISTS instructor_attendance (
  id SERIAL PRIMARY KEY,
  instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(instructor_id, activity_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_instructor_attendance_instructor ON instructor_attendance(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_attendance_activity ON instructor_attendance(activity_id);
CREATE INDEX IF NOT EXISTS idx_instructor_attendance_date ON instructor_attendance(attendance_date);

-- ============================================================
-- 4. Ledger — append-only. INSERT only, ever.
-- ============================================================

-- Same structure as freelancer_ledger_entries, with two differences:
--   1. entry_type is restricted to ('payment', 'session_pay',
--      'reversal') — no 'no_show_fee' equivalent, since instructors
--      aren't penalized for a session that didn't happen (out of
--      scope per spec).
--   2. related_attendance_id replaces related_session_id, pointing at
--      instructor_attendance instead of freelancer_sessions.
--
-- SIGN CONVENTION (the important part — read this before trusting any
-- amount in this table):
--   - 'session_pay' is POSITIVE: marking an instructor present
--     increases what the academy owes them.
--   - 'payment' is NEGATIVE: the academy actually paying out cash to
--     the instructor reduces what it owes them.
--   - This is the OPPOSITE polarity from freelancer_ledger_entries,
--     where session_charge is negative and payment is positive —
--     because money flows the other direction (freelancers pay the
--     academy for pool time; the academy pays instructors for
--     teaching). A positive instructor_balances.current_balance means
--     "the academy owes this instructor money," not the freelancer
--     ledger's "this account is in good standing" reading.
--   - 'reversal' just negates whatever it's reversing, same rule as
--     the freelancer ledger.
CREATE TABLE IF NOT EXISTS instructor_ledger_entries (
  id SERIAL PRIMARY KEY,
  -- RESTRICT (not CASCADE): an instructor with any financial history
  -- should never be deletable outright — deactivate them (active =
  -- false) instead at the app level if that's ever needed.
  instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL
    CHECK (entry_type IN ('payment', 'session_pay', 'reversal')),
  amount NUMERIC(10,2) NOT NULL,
  -- Helper/audit snapshot only, same as freelancer_ledger_entries —
  -- NOT the source of truth for current balance (see
  -- instructor_balances below) and never updated after insert
  -- (enforced by the append-only triggers below either way).
  balance_after NUMERIC(10,2) NOT NULL,
  note TEXT,
  related_attendance_id INTEGER REFERENCES instructor_attendance(id) ON DELETE SET NULL,
  reversed_entry_id INTEGER REFERENCES instructor_ledger_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Same reversal-fields rule as freelancer_ledger_entries: a
  -- 'reversal' entry must reference the entry it reverses and carry
  -- an explanatory note; every other entry_type must NOT set
  -- reversed_entry_id.
  CONSTRAINT instructor_ledger_entries_reversal_fields_consistent CHECK (
    (entry_type = 'reversal' AND reversed_entry_id IS NOT NULL AND note IS NOT NULL)
    OR
    (entry_type != 'reversal' AND reversed_entry_id IS NULL)
  ),
  -- session_pay must reference the attendance row it's paying for;
  -- payment must not (not tied to any one attendance row). 'reversal'
  -- is left unconstrained, same as the freelancer ledger — it may or
  -- may not carry a related_attendance_id depending on what it's
  -- reversing.
  CONSTRAINT instructor_ledger_entries_related_attendance_consistent CHECK (
    (entry_type = 'session_pay' AND related_attendance_id IS NOT NULL)
    OR
    (entry_type = 'payment' AND related_attendance_id IS NULL)
    OR
    (entry_type = 'reversal')
  )
);

-- Enforce "append-only" at the database level, identical mechanism to
-- freelancer_ledger_entries — any UPDATE or DELETE is rejected
-- outright, even from a bug or a manual SQL Editor slip.
CREATE OR REPLACE FUNCTION prevent_instructor_ledger_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'instructor_ledger_entries is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS instructor_ledger_entries_no_update ON instructor_ledger_entries;
CREATE TRIGGER instructor_ledger_entries_no_update
  BEFORE UPDATE ON instructor_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_instructor_ledger_mutation();

DROP TRIGGER IF EXISTS instructor_ledger_entries_no_delete ON instructor_ledger_entries;
CREATE TRIGGER instructor_ledger_entries_no_delete
  BEFORE DELETE ON instructor_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_instructor_ledger_mutation();

CREATE INDEX IF NOT EXISTS idx_instructor_ledger_entries_instructor ON instructor_ledger_entries(instructor_id, created_at);

-- Convenience view: each instructor's current balance, computed as
-- SUM(amount) across every one of their ledger entries (0 if none
-- yet) — not by reading any single entry's balance_after. Same
-- pattern as freelancer_balances.
CREATE OR REPLACE VIEW instructor_balances AS
SELECT
  i.id AS instructor_id,
  COALESCE(SUM(ile.amount), 0) AS current_balance
FROM instructors i
LEFT JOIN instructor_ledger_entries ile ON ile.instructor_id = i.id
GROUP BY i.id;

-- ============================================================
-- 5. add_instructor_ledger_entry() — manual entries
-- ============================================================

-- Line-for-line the same function as add_freelancer_ledger_entry()
-- (freelancer-add-ledger-entry-function-schema.sql), renamed to this
-- module's tables/columns. Same restrictions: entry_type limited to
-- 'payment' or 'reversal' only (never 'session_pay' — that's exclusively
-- inserted by record_instructor_attendance() above), same
-- reversal-requires-note/reversed_entry_id checks, same "can't reverse
-- an entry that's already been reversed" guard, same row lock on the
-- parent (instructors instead of freelancers) before computing the
-- running balance.
CREATE OR REPLACE FUNCTION add_instructor_ledger_entry(
  p_instructor_id INTEGER,
  p_entry_type TEXT,
  p_amount NUMERIC(10,2),
  p_note TEXT,
  p_reversed_entry_id INTEGER
) RETURNS void AS $$
DECLARE
  v_current_balance NUMERIC(10,2);
BEGIN
  IF p_entry_type NOT IN ('payment', 'reversal') THEN
    RAISE EXCEPTION 'invalid entry_type for manual entry: %', p_entry_type;
  END IF;

  IF p_entry_type = 'reversal' AND p_reversed_entry_id IS NULL THEN
    RAISE EXCEPTION 'reversal requires reversed_entry_id';
  END IF;

  IF p_entry_type = 'reversal' AND p_note IS NULL THEN
    RAISE EXCEPTION 'reversal requires a note';
  END IF;

  IF p_entry_type = 'reversal' THEN
    PERFORM 1 FROM instructor_ledger_entries
    WHERE id = p_reversed_entry_id AND instructor_id = p_instructor_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'reversed entry % not found for this instructor', p_reversed_entry_id;
    END IF;
  END IF;

  PERFORM 1 FROM instructors WHERE id = p_instructor_id FOR UPDATE;

  IF p_entry_type = 'reversal' THEN
    PERFORM 1 FROM instructor_ledger_entries WHERE reversed_entry_id = p_reversed_entry_id;
    IF FOUND THEN
      RAISE EXCEPTION 'entry % has already been reversed', p_reversed_entry_id;
    END IF;
  END IF;

  v_current_balance := COALESCE(
    (SELECT balance_after FROM instructor_ledger_entries
     WHERE instructor_id = p_instructor_id ORDER BY id DESC LIMIT 1),
    0
  );
  v_current_balance := v_current_balance + p_amount;

  INSERT INTO instructor_ledger_entries
    (instructor_id, entry_type, amount, balance_after, note, reversed_entry_id)
  VALUES
    (p_instructor_id, p_entry_type, p_amount, v_current_balance, p_note,
     CASE WHEN p_entry_type = 'reversal' THEN p_reversed_entry_id ELSE NULL END);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. record_instructor_attendance() — manual, button-triggered
-- ============================================================

-- Called manually from the UI (a button, per your confirmation — not
-- automatic/QR-driven like the freelancer flow). Upserts the
-- instructor_attendance row for (instructor, activity, date), then
-- reconciles the ledger against whatever actually changed:
--
--   - No prior row, or prior status differs from the new status, and
--     the NEW status is 'present': pay once (a fresh 'session_pay'
--     entry for default_rate_per_session). Covers both a normal first
--     mark AND a correction from a wrongly-recorded 'absent'.
--   - Prior status was 'present' and the NEW status is 'absent'
--     (a correction — the instructor was marked present by mistake):
--     find that attendance row's still-unreversed 'session_pay' entry
--     and insert a 'reversal' entry that exactly negates it. If no
--     such entry exists (shouldn't happen given the rule above, but
--     handled defensively), this is a no-op on the ledger.
--   - New status equals the current status already on file (called
--     again with the same value — e.g. a duplicate button press):
--     no-op entirely, no ledger entry, so re-clicking "present" on an
--     already-present day never double-pays.
--
-- This makes present -> absent -> present net out to exactly one
-- unreversed session_pay entry (the first pay gets reversed, the
-- second mark pays fresh) — never a double payment, and every
-- correction leaves a full audit trail instead of silently
-- overwriting anything.
CREATE OR REPLACE FUNCTION record_instructor_attendance(
  p_instructor_id INTEGER,
  p_activity_id INTEGER,
  p_attendance_date DATE,
  p_status TEXT
) RETURNS void AS $$
DECLARE
  v_attendance_id INTEGER;
  v_previous_status TEXT;
  v_rate NUMERIC(10,2);
  v_current_balance NUMERIC(10,2);
  v_existing_pay_entry RECORD;
BEGIN
  IF p_status NOT IN ('present', 'absent') THEN
    RAISE EXCEPTION 'invalid status: %', p_status;
  END IF;

  -- Lock the instructor row to serialize balance computation against
  -- any concurrent ledger-affecting operation for the same instructor.
  PERFORM 1 FROM instructors WHERE id = p_instructor_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'instructor % not found', p_instructor_id;
  END IF;

  SELECT status INTO v_previous_status
  FROM instructor_attendance
  WHERE instructor_id = p_instructor_id AND activity_id = p_activity_id AND attendance_date = p_attendance_date
  FOR UPDATE;

  INSERT INTO instructor_attendance (instructor_id, activity_id, attendance_date, status)
  VALUES (p_instructor_id, p_activity_id, p_attendance_date, p_status)
  ON CONFLICT (instructor_id, activity_id, attendance_date)
  DO UPDATE SET status = EXCLUDED.status
  RETURNING id INTO v_attendance_id;

  -- No-op: status unchanged from what it already was.
  IF v_previous_status IS NOT DISTINCT FROM p_status THEN
    RETURN;
  END IF;

  v_current_balance := COALESCE(
    (SELECT balance_after FROM instructor_ledger_entries
     WHERE instructor_id = p_instructor_id ORDER BY id DESC LIMIT 1),
    0
  );

  IF p_status = 'present' THEN
    SELECT default_rate_per_session INTO v_rate FROM instructors WHERE id = p_instructor_id;

    IF v_rate IS NULL THEN
      RAISE EXCEPTION 'no default_rate_per_session configured for instructor %', p_instructor_id;
    END IF;

    v_current_balance := v_current_balance + v_rate;

    INSERT INTO instructor_ledger_entries
      (instructor_id, entry_type, amount, balance_after, note, related_attendance_id)
    VALUES
      (p_instructor_id, 'session_pay', v_rate, v_current_balance, 'حضور حصة', v_attendance_id);
  ELSE
    -- Correcting a previous 'present' down to 'absent': reverse the
    -- session_pay entry tied to this attendance row, if one exists
    -- and hasn't already been reversed.
    SELECT ile.* INTO v_existing_pay_entry
    FROM instructor_ledger_entries ile
    WHERE ile.related_attendance_id = v_attendance_id AND ile.entry_type = 'session_pay'
      AND NOT EXISTS (
        SELECT 1 FROM instructor_ledger_entries r WHERE r.reversed_entry_id = ile.id
      )
    LIMIT 1;

    IF FOUND THEN
      v_current_balance := v_current_balance - v_existing_pay_entry.amount;

      INSERT INTO instructor_ledger_entries
        (instructor_id, entry_type, amount, balance_after, note, reversed_entry_id)
      VALUES
        (p_instructor_id, 'reversal', -1 * v_existing_pay_entry.amount, v_current_balance,
         'تصحيح: تعديل الحضور من حاضر إلى غايب', v_existing_pay_entry.id);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;
