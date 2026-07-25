-- Freelancer QR-scan function — NEW function only, completely additive.
-- Does not alter freelancers-schema.sql, freelancer-notifications-schema.sql,
-- freelancer-reset-function-schema.sql, freelancer-close-session-function-schema.sql,
-- freelancer-create-session-function-schema.sql, or schema.sql.
-- Review only. Do NOT run this until approved.
--
-- Depends on freelancers-schema.sql already being applied. Run once in
-- the Neon SQL Editor, after review.
--
-- Verified against the actual schema before writing this file — no
-- corrections were needed:
--   - session_qr_tokens(token, status, expires_at, session_id) all match
--     exactly (token TEXT UNIQUE NOT NULL, status TEXT CHECK IN ('unused',
--     'scanned', 'expired_no_show'), expires_at TIMESTAMPTZ NOT NULL,
--     session_id INTEGER NOT NULL REFERENCES freelancer_sessions(id)).
--   - freelancer_sessions.status CHECK includes both 'approved' and
--     'checked_in', matching the transition performed below.
--   - Setting status='scanned' together with scanned_at=now() in the
--     same UPDATE satisfies session_qr_tokens_scanned_at_consistent
--     (both fields set together, never one without the other).

CREATE OR REPLACE FUNCTION scan_freelancer_qr_token(p_session_id INTEGER, p_token TEXT) RETURNS void AS $$
DECLARE
  v_token_status TEXT;
  v_expires_at TIMESTAMPTZ;
  v_token_session_id INTEGER;
BEGIN
  SELECT status, expires_at, session_id INTO v_token_status, v_expires_at, v_token_session_id
  FROM session_qr_tokens
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid QR token';
  END IF;

  IF v_token_session_id != p_session_id THEN
    RAISE EXCEPTION 'token does not belong to this session';
  END IF;

  IF v_token_status != 'unused' THEN
    RAISE EXCEPTION 'token already used or expired';
  END IF;

  IF v_expires_at <= now() THEN
    RAISE EXCEPTION 'token has expired';
  END IF;

  UPDATE session_qr_tokens SET status = 'scanned', scanned_at = now() WHERE token = p_token;

  UPDATE freelancer_sessions SET status = 'checked_in' WHERE id = p_session_id AND status = 'approved';
END;
$$ LANGUAGE plpgsql;
