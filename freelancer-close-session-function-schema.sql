-- Freelancer session-close function — NEW function only, completely
-- additive. Does not alter freelancers-schema.sql, freelancer-
-- notifications-schema.sql, freelancer-reset-function-schema.sql, or
-- schema.sql. Review only. Do NOT run this until approved.
--
-- Depends on freelancers-schema.sql and freelancer-notifications-schema.sql
-- already being applied. Run once in the Neon SQL Editor, after review.
--
-- Verified against the actual schema before writing this file — no
-- naming corrections were needed:
--   - freelancer_sessions.status CHECK is exactly
--     ('pending', 'approved', 'checked_in', 'closed', 'rejected').
--   - freelancer_sessions.closed_by CHECK is exactly
--     closed_by IS NULL OR closed_by IN ('manual', 'auto').
--   - freelancer_settings' seeded row is exactly ('no_show_fee', '10'),
--     matching the key used below.
--   - session_qr_tokens.status CHECK is exactly
--     ('unused', 'scanned', 'expired_no_show').
--   - freelancer_ledger_entries.entry_type CHECK includes both
--     'session_charge' and 'no_show_fee', and both require
--     related_session_id per freelancer_ledger_entries_related_session_consistent
--     — satisfied below.

CREATE OR REPLACE FUNCTION close_freelancer_session(p_session_id INTEGER, p_closed_by TEXT) RETURNS void AS $$
DECLARE
  v_freelancer_id INTEGER;
  v_status TEXT;
  v_current_balance NUMERIC(10,2);
  v_price NUMERIC(10,2);
  v_amount NUMERIC(10,2);
  v_noshow_count INTEGER;
  v_noshow_fee NUMERIC(10,2);
  rec RECORD;
BEGIN
  IF p_closed_by NOT IN ('manual', 'auto') THEN
    RAISE EXCEPTION 'invalid closed_by value: %', p_closed_by;
  END IF;

  SELECT freelancer_id, status INTO v_freelancer_id, v_status
  FROM freelancer_sessions WHERE id = p_session_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session % not found', p_session_id;
  END IF;

  IF v_status = 'closed' THEN
    RETURN; -- already closed, idempotent no-op
  END IF;

  IF v_status NOT IN ('approved', 'checked_in') THEN
    RAISE EXCEPTION 'cannot close session % in status %', p_session_id, v_status;
  END IF;

  -- Lock the freelancer row to serialize balance computation against
  -- any concurrent ledger-affecting operation for the same freelancer.
  PERFORM 1 FROM freelancers WHERE id = v_freelancer_id FOR UPDATE;

  v_current_balance := COALESCE(
    (SELECT balance_after FROM freelancer_ledger_entries
     WHERE freelancer_id = v_freelancer_id ORDER BY id DESC LIMIT 1),
    0
  );

  UPDATE session_qr_tokens SET status = 'expired_no_show'
  WHERE session_id = p_session_id AND status = 'unused';

  FOR rec IN
    SELECT level, COUNT(*) AS cnt
    FROM session_qr_tokens
    WHERE session_id = p_session_id AND status = 'scanned'
    GROUP BY level
  LOOP
    v_price := COALESCE(
      (SELECT price FROM freelancer_pricing_overrides
       WHERE freelancer_id = v_freelancer_id AND level = rec.level),
      (SELECT price FROM level_default_pricing WHERE level = rec.level)
    );

    IF v_price IS NULL THEN
      RAISE EXCEPTION 'no price configured for level %', rec.level;
    END IF;

    v_amount := -1 * (rec.cnt * v_price);
    v_current_balance := v_current_balance + v_amount;

    INSERT INTO freelancer_ledger_entries
      (freelancer_id, entry_type, amount, balance_after, note, related_session_id)
    VALUES
      (v_freelancer_id, 'session_charge', v_amount, v_current_balance,
       rec.level || ' — ' || rec.cnt || ' دخول', p_session_id);
  END LOOP;

  SELECT COUNT(*) INTO v_noshow_count
  FROM session_qr_tokens
  WHERE session_id = p_session_id AND status = 'expired_no_show';

  IF v_noshow_count > 0 THEN
    SELECT value::numeric INTO v_noshow_fee FROM freelancer_settings WHERE key = 'no_show_fee';

    IF v_noshow_fee IS NULL THEN
      RAISE EXCEPTION 'no_show_fee setting not found';
    END IF;

    v_amount := -1 * (v_noshow_count * v_noshow_fee);
    v_current_balance := v_current_balance + v_amount;

    INSERT INTO freelancer_ledger_entries
      (freelancer_id, entry_type, amount, balance_after, note, related_session_id)
    VALUES
      (v_freelancer_id, 'no_show_fee', v_amount, v_current_balance,
       v_noshow_count || ' غياب', p_session_id);
  END IF;

  UPDATE freelancer_sessions
  SET status = 'closed', closed_at = now(), closed_by = p_closed_by
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;
