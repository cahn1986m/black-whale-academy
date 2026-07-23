-- Freelancers module — NEW tables only, completely additive.
-- Does not alter/reference-modify any existing table in schema.sql.
-- Review only. Do NOT run this until approved.
--
-- Run once in the Neon SQL Editor (same process as schema.sql), after review.

-- ============================================================
-- 1. Pricing (defined before freelancers/sessions since both
--    reference "level" as a natural key).
-- ============================================================

-- Fixed set of allowed level values, enforced everywhere `level` is
-- used (via CHECK below, and transitively via FK on the two tables
-- that reference level_default_pricing(level)).
--
-- Admin-editable default price per level. `level` is a natural key
-- (no surrogate id) restricted to exactly these four values.
CREATE TABLE IF NOT EXISTS level_default_pricing (
  level TEXT PRIMARY KEY CHECK (level IN ('Level 1', 'Level 2', 'Level 3', 'Level 4')),
  price NUMERIC(10,2) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. Freelancers
-- ============================================================

CREATE TABLE IF NOT EXISTS freelancers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  -- Hashed PIN (e.g. scrypt/bcrypt output), never the raw 4-digit PIN.
  -- The "must be 4 digits" rule applies to the input before hashing,
  -- enforced in the app layer — not meaningful as a DB constraint on
  -- the hash itself.
  pin_hash TEXT NOT NULL,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  -- NULL = not locked. App sets this to now() + some duration once
  -- failed_login_attempts reaches 5; the "5" threshold is app logic,
  -- not a DB constraint.
  locked_until TIMESTAMPTZ,
  payment_type TEXT NOT NULL DEFAULT 'prepaid'
    CHECK (payment_type IN ('prepaid', 'monthly', 'on_account')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
  -- Deliberately NO balance column — current balance is always
  -- derived as SUM(amount) over freelancer_ledger_entries (see the
  -- freelancer_balances view below), never stored as a directly-
  -- editable field.
);

-- Audit trail of payment_type changes on freelancers. freelancer_id is
-- ON DELETE RESTRICT for the same reason as elsewhere: a freelancer
-- with any recorded history shouldn't be deletable outright.
CREATE TABLE IF NOT EXISTS freelancer_payment_type_history (
  id SERIAL PRIMARY KEY,
  freelancer_id INTEGER NOT NULL REFERENCES freelancers(id) ON DELETE RESTRICT,
  old_payment_type TEXT,
  new_payment_type TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Logged at the database level (not left to app code) so no
-- payment_type change can ever slip by unrecorded, regardless of which
-- code path performed the UPDATE.
CREATE OR REPLACE FUNCTION log_freelancer_payment_type_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.payment_type IS DISTINCT FROM NEW.payment_type THEN
    INSERT INTO freelancer_payment_type_history (freelancer_id, old_payment_type, new_payment_type)
    VALUES (NEW.id, OLD.payment_type, NEW.payment_type);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS freelancers_log_payment_type_change ON freelancers;
CREATE TRIGGER freelancers_log_payment_type_change
  AFTER UPDATE ON freelancers
  FOR EACH ROW EXECUTE FUNCTION log_freelancer_payment_type_change();

-- Per-freelancer price override for a given level. If no row exists
-- here for a (freelancer, level) pair, the app falls back to
-- level_default_pricing.
-- freelancer_id is ON DELETE RESTRICT (not CASCADE): a freelancer
-- with pricing overrides on file can't be deleted outright.
CREATE TABLE IF NOT EXISTS freelancer_pricing_overrides (
  id SERIAL PRIMARY KEY,
  freelancer_id INTEGER NOT NULL REFERENCES freelancers(id) ON DELETE RESTRICT,
  level TEXT NOT NULL REFERENCES level_default_pricing(level) ON DELETE CASCADE
    CHECK (level IN ('Level 1', 'Level 2', 'Level 3', 'Level 4')),
  price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(freelancer_id, level)
);

-- ============================================================
-- 3. Sessions (booking requests)
-- ============================================================

-- freelancer_id is ON DELETE RESTRICT (not CASCADE): a freelancer
-- with any session history can't be deleted outright.
CREATE TABLE IF NOT EXISTS freelancer_sessions (
  id SERIAL PRIMARY KEY,
  freelancer_id INTEGER NOT NULL REFERENCES freelancers(id) ON DELETE RESTRICT,
  session_date DATE NOT NULL,
  session_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'checked_in', 'closed', 'rejected')),
  closed_at TIMESTAMPTZ,
  closed_by TEXT CHECK (closed_by IS NULL OR closed_by IN ('manual', 'auto')),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- A session must have both closed_at and closed_by set once status
  -- is 'closed', and neither set otherwise. 'rejected' falls under the
  -- "status != 'closed'" branch here, same as every other non-closed
  -- status — unaffected by the addition of 'rejected' below.
  CONSTRAINT freelancer_sessions_closed_fields_consistent CHECK (
    (status = 'closed' AND closed_at IS NOT NULL AND closed_by IS NOT NULL)
    OR
    (status != 'closed' AND closed_at IS NULL AND closed_by IS NULL)
  ),
  -- Same pattern for rejection: both rejection fields set iff status
  -- is 'rejected'. Together with the constraint above, a 'rejected'
  -- session always has closed_at/closed_by NULL and rejected_at/
  -- rejection_reason NOT NULL — no overlap between the two states.
  CONSTRAINT freelancer_sessions_rejected_fields_consistent CHECK (
    (status = 'rejected' AND rejected_at IS NOT NULL AND rejection_reason IS NOT NULL)
    OR
    (status != 'rejected' AND rejected_at IS NULL AND rejection_reason IS NULL)
  )
);

-- "Number of children requested per level" is inherently one row per
-- (session, level) — modeled as a child table (same normalized style
-- as activity_packages in schema.sql) rather than a JSON blob, so
-- counts stay directly queryable/summable in SQL. If you actually
-- wanted a single JSONB column on freelancer_sessions instead, say so
-- and I'll redo this part — this is my interpretation of that one bullet.
CREATE TABLE IF NOT EXISTS freelancer_session_level_counts (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES freelancer_sessions(id) ON DELETE CASCADE,
  level TEXT NOT NULL REFERENCES level_default_pricing(level)
    CHECK (level IN ('Level 1', 'Level 2', 'Level 3', 'Level 4')),
  child_count INTEGER NOT NULL CHECK (child_count > 0),
  UNIQUE(session_id, level)
);

-- ============================================================
-- 4. Per-child temporary QR tokens for a session
-- ============================================================

-- session_id is ON DELETE RESTRICT (not CASCADE): a session with any
-- issued QR tokens can't be deleted outright.
CREATE TABLE IF NOT EXISTS session_qr_tokens (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES freelancer_sessions(id) ON DELETE RESTRICT,
  -- The level of the child this token was generated for, known at
  -- generation time (drawn from the session's level_counts breakdown).
  level TEXT NOT NULL REFERENCES level_default_pricing(level)
    CHECK (level IN ('Level 1', 'Level 2', 'Level 3', 'Level 4')),
  -- Generate with a cryptographically random, unguessable value
  -- (app layer) — long token, not a short/sequential code.
  -- UNIQUE constraint below is enforced by Postgres at the DB level.
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'unused'
    CHECK (status IN ('unused', 'scanned', 'expired_no_show')),
  -- Set by the app at creation time to (session start) + 1 hour.
  expires_at TIMESTAMPTZ NOT NULL,
  scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- scanned_at set iff status is 'scanned'.
  CONSTRAINT session_qr_tokens_scanned_at_consistent CHECK (
    (status = 'scanned' AND scanned_at IS NOT NULL)
    OR
    (status != 'scanned' AND scanned_at IS NULL)
  )
);

-- Enforce, at the database level, that tokens can never be issued
-- beyond what a session actually requested per level:
--   1. No freelancer_session_level_counts row for (session_id, level)
--      at all -> reject (that level wasn't requested for this session).
--   2. Already-issued tokens for (session_id, level) >= the requested
--      child_count -> reject (would exceed the requested count).
CREATE OR REPLACE FUNCTION enforce_session_qr_token_level_limit() RETURNS TRIGGER AS $$
DECLARE
  required_count INTEGER;
  issued_count INTEGER;
BEGIN
  SELECT child_count INTO required_count
  FROM freelancer_session_level_counts
  WHERE session_id = NEW.session_id AND level = NEW.level
  FOR UPDATE;

  IF required_count IS NULL THEN
    RAISE EXCEPTION 'Session % did not request any children of level %', NEW.session_id, NEW.level;
  END IF;

  SELECT COUNT(*) INTO issued_count
  FROM session_qr_tokens
  WHERE session_id = NEW.session_id AND level = NEW.level;

  IF issued_count >= required_count THEN
    RAISE EXCEPTION 'Session % already has % of % requested QR tokens for level % — cannot issue another', NEW.session_id, issued_count, required_count, NEW.level;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS session_qr_tokens_enforce_level_limit ON session_qr_tokens;
CREATE TRIGGER session_qr_tokens_enforce_level_limit
  BEFORE INSERT ON session_qr_tokens
  FOR EACH ROW EXECUTE FUNCTION enforce_session_qr_token_level_limit();

-- ============================================================
-- 5. Ledger — append-only. INSERT only, ever.
-- ============================================================

CREATE TABLE IF NOT EXISTS freelancer_ledger_entries (
  id SERIAL PRIMARY KEY,
  -- RESTRICT (not CASCADE): a freelancer with any financial history
  -- should never be deletable outright — unenroll/deactivate them
  -- instead at the app level if that's ever needed.
  freelancer_id INTEGER NOT NULL REFERENCES freelancers(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL
    CHECK (entry_type IN ('payment', 'session_charge', 'no_show_fee', 'reversal')),
  amount NUMERIC(10,2) NOT NULL,
  -- Helper/audit snapshot only — the running balance as computed by
  -- the app at insert time, for quick historical reference on a
  -- statement/ledger view. It is NOT the source of truth for a
  -- freelancer's current balance (see freelancer_balances below,
  -- which sums `amount` independently) and is never updated after
  -- insert (enforced by the append-only triggers below either way).
  balance_after NUMERIC(10,2) NOT NULL,
  note TEXT,
  related_session_id INTEGER REFERENCES freelancer_sessions(id) ON DELETE SET NULL,
  reversed_entry_id INTEGER REFERENCES freelancer_ledger_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- A 'reversal' entry must reference the entry it reverses and carry
  -- an explanatory note; every other entry_type must NOT set
  -- reversed_entry_id (note is still optional for non-reversal entries).
  CONSTRAINT freelancer_ledger_entries_reversal_fields_consistent CHECK (
    (entry_type = 'reversal' AND reversed_entry_id IS NOT NULL AND note IS NOT NULL)
    OR
    (entry_type != 'reversal' AND reversed_entry_id IS NULL)
  ),
  -- session_charge/no_show_fee must reference the session they're for;
  -- payment must not (not tied to any one session). 'reversal' is left
  -- unconstrained by this rule — it may or may not carry a
  -- related_session_id depending on what it's reversing.
  CONSTRAINT freelancer_ledger_entries_related_session_consistent CHECK (
    (entry_type IN ('session_charge', 'no_show_fee') AND related_session_id IS NOT NULL)
    OR
    (entry_type = 'payment' AND related_session_id IS NULL)
    OR
    (entry_type = 'reversal')
  )
);

-- Enforce "append-only" at the database level, not just as an app
-- convention — any UPDATE or DELETE against this table is rejected
-- outright, even from a bug or a manual SQL Editor slip.
CREATE OR REPLACE FUNCTION prevent_ledger_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'freelancer_ledger_entries is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS freelancer_ledger_entries_no_update ON freelancer_ledger_entries;
CREATE TRIGGER freelancer_ledger_entries_no_update
  BEFORE UPDATE ON freelancer_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

DROP TRIGGER IF EXISTS freelancer_ledger_entries_no_delete ON freelancer_ledger_entries;
CREATE TRIGGER freelancer_ledger_entries_no_delete
  BEFORE DELETE ON freelancer_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

-- Convenience view: each freelancer's current balance, computed as
-- SUM(amount) across every one of their ledger entries (0 if they
-- have none yet) — not by reading any single entry's balance_after.
-- Not part of your listed spec — purely a read-only convenience so
-- the app never needs to hand-roll this sum in multiple places.
-- Safe to drop if you don't want it.
CREATE OR REPLACE VIEW freelancer_balances AS
SELECT
  f.id AS freelancer_id,
  COALESCE(SUM(le.amount), 0) AS current_balance
FROM freelancers f
LEFT JOIN freelancer_ledger_entries le ON le.freelancer_id = f.id
GROUP BY f.id;

-- ============================================================
-- 6. General settings for this module
-- ============================================================

-- Generic key/value settings, scoped to the freelancers module —
-- kept separate from the existing admin_settings table (which is
-- specifically the /admin login password) to avoid mixing concerns.
CREATE TABLE IF NOT EXISTS freelancer_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO freelancer_settings (key, value) VALUES ('no_show_fee', '10')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_freelancer_payment_type_history_freelancer ON freelancer_payment_type_history(freelancer_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_freelancer_pricing_overrides_freelancer ON freelancer_pricing_overrides(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_freelancer_sessions_freelancer ON freelancer_sessions(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_freelancer_sessions_status ON freelancer_sessions(status);
CREATE INDEX IF NOT EXISTS idx_freelancer_sessions_date ON freelancer_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_freelancer_session_level_counts_session ON freelancer_session_level_counts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_qr_tokens_session ON session_qr_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_session_qr_tokens_status ON session_qr_tokens(status);
CREATE INDEX IF NOT EXISTS idx_freelancer_ledger_entries_freelancer ON freelancer_ledger_entries(freelancer_id, created_at);
