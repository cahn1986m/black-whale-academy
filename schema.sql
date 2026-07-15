-- شغّل هذا الملف مرة واحدة داخل Neon SQL Editor لإنشاء الجداول

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT,
  instructor_name TEXT,
  schedule_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_packages (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  session_count INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS children (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  parent_contact TEXT,
  photo_base64 TEXT,
  qr_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  package_id INTEGER REFERENCES activity_packages(id) ON DELETE SET NULL,
  sessions_total INTEGER NOT NULL,
  price_paid NUMERIC,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, activity_id)
);

CREATE TABLE IF NOT EXISTS activity_attendance (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',
  marked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(enrollment_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_activity_packages_activity ON activity_packages(activity_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_child ON enrollments(child_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_activity ON enrollments(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_attendance_date ON activity_attendance(attendance_date);
