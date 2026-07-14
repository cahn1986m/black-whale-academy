-- شغّل هذا الملف مرة واحدة داخل Neon SQL Editor لإنشاء الجداول

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  supervisor_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS children (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  parent_contact TEXT,
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  photo_base64 TEXT,
  qr_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  marked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_children_group ON children(group_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
