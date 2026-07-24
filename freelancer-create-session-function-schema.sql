-- Freelancer create-session-request function — NEW function only,
-- completely additive. Does not alter freelancers-schema.sql,
-- freelancer-notifications-schema.sql, freelancer-reset-function-schema.sql,
-- freelancer-close-session-function-schema.sql, or schema.sql.
-- Review only. Do NOT run this until approved.
--
-- Depends on freelancers-schema.sql already being applied.
-- Run once in the Neon SQL Editor, after review.
--
-- Verified against the actual schema before writing this file — no
-- corrections were needed:
--   - freelancer_sessions(freelancer_id, session_date, session_time, status)
--     columns and types match exactly; status CHECK includes 'pending'.
--   - freelancer_session_level_counts(session_id, level, child_count) —
--     level is TEXT NOT NULL (REFERENCES level_default_pricing(level),
--     plus its own CHECK IN ('Level 1','Level 2','Level 3','Level 4'));
--     child_count is INTEGER NOT NULL CHECK (child_count > 0). This
--     function never hardcodes the four level strings — it validates
--     each level dynamically via the price lookup below, which relies
--     on the same level_default_pricing row the CHECK/FK also point to.

CREATE OR REPLACE FUNCTION create_freelancer_session_request(
  p_freelancer_id INTEGER,
  p_session_date DATE,
  p_session_time TIME,
  p_level_counts JSONB
) RETURNS INTEGER AS $$
DECLARE
  v_session_id INTEGER;
  rec RECORD;
  v_price NUMERIC(10,2);
BEGIN
  IF p_level_counts IS NULL OR jsonb_array_length(p_level_counts) = 0 THEN
    RAISE EXCEPTION 'level counts required';
  END IF;

  FOR rec IN SELECT * FROM jsonb_to_recordset(p_level_counts) AS x(level TEXT, count INTEGER)
  LOOP
    IF rec.count IS NULL OR rec.count <= 0 THEN
      RAISE EXCEPTION 'invalid count for level %', rec.level;
    END IF;

    v_price := COALESCE(
      (SELECT price FROM freelancer_pricing_overrides WHERE freelancer_id = p_freelancer_id AND level = rec.level),
      (SELECT price FROM level_default_pricing WHERE level = rec.level)
    );

    IF v_price IS NULL THEN
      RAISE EXCEPTION 'no price configured for level %', rec.level;
    END IF;
  END LOOP;

  INSERT INTO freelancer_sessions (freelancer_id, session_date, session_time, status)
  VALUES (p_freelancer_id, p_session_date, p_session_time, 'pending')
  RETURNING id INTO v_session_id;

  FOR rec IN SELECT * FROM jsonb_to_recordset(p_level_counts) AS x(level TEXT, count INTEGER)
  LOOP
    INSERT INTO freelancer_session_level_counts (session_id, level, child_count)
    VALUES (v_session_id, rec.level, rec.count);
  END LOOP;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;
