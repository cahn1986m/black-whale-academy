-- Freelancer manual ledger-entry function — NEW function only,
-- completely additive. Does not alter freelancers-schema.sql,
-- freelancer-notifications-schema.sql, freelancer-reset-function-schema.sql,
-- freelancer-close-session-function-schema.sql, freelancer-create-session-function-schema.sql,
-- freelancer-scan-qr-function-schema.sql, or schema.sql.
-- Review only. Do NOT run this until approved.
--
-- Depends on freelancers-schema.sql already being applied. Run once in
-- the Neon SQL Editor, after review.
--
-- Verified against the actual schema before writing this file:
--   - freelancer_ledger_entries_reversal_fields_consistent is the real
--     constraint name, and it requires note IS NOT NULL specifically
--     when entry_type = 'reversal' (the note column is otherwise
--     nullable — no NOT NULL requirement for 'payment'/'session_charge'/
--     'no_show_fee'). The original draft relied on this CHECK
--     constraint alone to reject a NULL note for a reversal, which
--     would surface as an opaque 23514 constraint-violation error;
--     added an explicit RAISE EXCEPTION below so callers get a clean,
--     readable P0001 error instead.
--   - freelancer_ledger_entries_related_session_consistent is
--     unaffected: this function never sets related_session_id (stays
--     NULL), which satisfies that constraint for 'payment' entries and
--     is left unconstrained for 'reversal' entries.

CREATE OR REPLACE FUNCTION add_freelancer_ledger_entry(
  p_freelancer_id INTEGER,
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
    PERFORM 1 FROM freelancer_ledger_entries
    WHERE id = p_reversed_entry_id AND freelancer_id = p_freelancer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'reversed entry % not found for this freelancer', p_reversed_entry_id;
    END IF;
  END IF;

  PERFORM 1 FROM freelancers WHERE id = p_freelancer_id FOR UPDATE;

  IF p_entry_type = 'reversal' THEN
    PERFORM 1 FROM freelancer_ledger_entries WHERE reversed_entry_id = p_reversed_entry_id;
    IF FOUND THEN
      RAISE EXCEPTION 'entry % has already been reversed', p_reversed_entry_id;
    END IF;
  END IF;

  v_current_balance := COALESCE(
    (SELECT balance_after FROM freelancer_ledger_entries
     WHERE freelancer_id = p_freelancer_id ORDER BY id DESC LIMIT 1),
    0
  );
  v_current_balance := v_current_balance + p_amount;

  INSERT INTO freelancer_ledger_entries
    (freelancer_id, entry_type, amount, balance_after, note, reversed_entry_id)
  VALUES
    (p_freelancer_id, p_entry_type, p_amount, v_current_balance, p_note,
     CASE WHEN p_entry_type = 'reversal' THEN p_reversed_entry_id ELSE NULL END);
END;
$$ LANGUAGE plpgsql;
