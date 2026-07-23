-- Freelancer notifications module — NEW table only, completely additive.
-- Does not alter/reference-modify freelancers-schema.sql or schema.sql.
-- Review only. Do NOT run this until approved.
--
-- Depends on freelancers-schema.sql already being applied (FKs below
-- reference freelancers and freelancer_sessions). Run once in the Neon
-- SQL Editor, after review.

CREATE TABLE IF NOT EXISTS freelancer_notifications (
  id SERIAL PRIMARY KEY,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('freelancer', 'admin')),
  recipient_id INTEGER REFERENCES freelancers(id) ON DELETE RESTRICT,
  session_id INTEGER NOT NULL REFERENCES freelancer_sessions(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('approved', 'rejected', 'closed')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- recipient_id set iff recipient_type = 'freelancer'; admin notifications
  -- have no per-row recipient identity, so recipient_id must be NULL.
  CONSTRAINT freelancer_notifications_recipient_consistent CHECK (
    (recipient_type = 'freelancer' AND recipient_id IS NOT NULL)
    OR
    (recipient_type = 'admin' AND recipient_id IS NULL)
  ),
  -- read_at set iff is_read is true.
  CONSTRAINT freelancer_notifications_read_consistent CHECK (
    (is_read = true AND read_at IS NOT NULL)
    OR
    (is_read = false AND read_at IS NULL)
  )
);

-- Speeds up the "unread notifications for this recipient" query, the
-- main access pattern for a notifications list/badge.
CREATE INDEX IF NOT EXISTS idx_freelancer_notifications_recipient_unread
  ON freelancer_notifications(recipient_type, recipient_id, is_read);

-- Fires only when freelancer_sessions.status actually changes (guards
-- against re-firing on unrelated updates to the same row), and only
-- inserts notifications for the three transitions that matter —
-- 'pending'/'checked_in' (or any other value) produce nothing.
CREATE OR REPLACE FUNCTION notify_freelancer_session_status_change() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO freelancer_notifications (recipient_type, recipient_id, session_id, event_type)
      VALUES ('freelancer', NEW.freelancer_id, NEW.id, 'approved');
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO freelancer_notifications (recipient_type, recipient_id, session_id, event_type)
      VALUES ('freelancer', NEW.freelancer_id, NEW.id, 'rejected');
    ELSIF NEW.status = 'closed' THEN
      INSERT INTO freelancer_notifications (recipient_type, recipient_id, session_id, event_type)
      VALUES ('freelancer', NEW.freelancer_id, NEW.id, 'closed');
      INSERT INTO freelancer_notifications (recipient_type, recipient_id, session_id, event_type)
      VALUES ('admin', NULL, NEW.id, 'closed');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS freelancer_sessions_notify_status_change ON freelancer_sessions;
CREATE TRIGGER freelancer_sessions_notify_status_change
  AFTER UPDATE ON freelancer_sessions
  FOR EACH ROW EXECUTE FUNCTION notify_freelancer_session_status_change();
