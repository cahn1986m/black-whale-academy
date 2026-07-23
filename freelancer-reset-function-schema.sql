-- Freelancer test-data reset helper — NEW function + one re-pointed
-- trigger only. Does not alter freelancers-schema.sql or schema.sql
-- as files, and does NOT touch freelancer_ledger_entries_no_update or
-- the prevent_ledger_mutation() function it uses — that trigger/
-- function pair is left completely untouched, unchanged, unreferenced.
-- Review only. Do NOT run this until approved.
--
-- Depends on freelancers-schema.sql and freelancer-notifications-schema.sql
-- already being applied. Run once in the Neon SQL Editor, after review.

-- ============================================================
-- 1. Split the append-only guard: freelancer_ledger_entries_no_delete
--    now points at its own dedicated function instead of sharing
--    prevent_ledger_mutation() with freelancer_ledger_entries_no_update.
--    (prevent_ledger_mutation() itself, and the no_update trigger that
--    still uses it, are NOT touched by this file at all.)
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_ledger_delete_unless_reset() RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.reset_in_progress', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'freelancer_ledger_entries is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS freelancer_ledger_entries_no_delete ON freelancer_ledger_entries;
CREATE TRIGGER freelancer_ledger_entries_no_delete
  BEFORE DELETE ON freelancer_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_delete_unless_reset();

-- ============================================================
-- 2. Test-data reset function
-- ============================================================

-- Wipes every freelancers-module row EXCEPT level_default_pricing and
-- freelancer_settings (those are configuration, not test data).
-- SET LOCAL scopes app.reset_in_progress to this transaction only —
-- it reverts automatically once this function's transaction ends, so
-- the DELETE bypass above never stays "on" beyond this single call.
-- Delete order verified against every FK in freelancers-schema.sql and
-- freelancer-notifications-schema.sql: each RESTRICT-referencing child
-- table is cleared before its RESTRICT-referenced parent (freelancer_
-- session_level_counts is CASCADE from freelancer_sessions, so its
-- position here is for explicitness, not a blocking requirement).
CREATE OR REPLACE FUNCTION reset_freelancer_test_data() RETURNS void AS $$
BEGIN
  SET LOCAL app.reset_in_progress = 'true';

  DELETE FROM freelancer_notifications;
  DELETE FROM session_qr_tokens;
  DELETE FROM freelancer_ledger_entries;
  DELETE FROM freelancer_session_level_counts;
  DELETE FROM freelancer_sessions;
  DELETE FROM freelancer_pricing_overrides;
  DELETE FROM freelancer_payment_type_history;
  DELETE FROM freelancers;
END;
$$ LANGUAGE plpgsql;
