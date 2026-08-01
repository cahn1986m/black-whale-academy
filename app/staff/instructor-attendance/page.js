'use client';

import { useEffect, useState } from 'react';
import Header from '../../Header';

export default function StaffInstructorAttendancePage() {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/staff/instructor-attendance', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'صار خطأ');
        setInstructors(data.instructors);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const markAttendance = async (instructorId, status) => {
    try {
      const res = await fetch('/api/staff/instructor-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setInstructors((prev) => prev.map((i) => (i.id === instructorId ? { ...i, status } : i)));
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    }
  };

  return (
    <div className="page">
      <a href="/staff" className="back-link">← بوابة الموظفين</a>
      <Header sub="حضور مدربي الأنشطة" />
      {error && <div className="msg error">{error}</div>}

      {loading && <div className="empty">جاري التحميل...</div>}
      {!loading && instructors.length === 0 && <div className="empty">ما في مدربين نشطين حالياً</div>}

      {!loading &&
        instructors.map((i) => (
          <div className="child-row" key={i.id}>
            <span className="name">{i.name}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => markAttendance(i.id, 'present')}
                className="status-pill"
                style={
                  i.status === 'present'
                    ? { background: 'rgba(34, 181, 115, 0.16)', color: 'var(--present)' }
                    : { background: 'var(--surface)', color: 'var(--text-dim)', border: '1px solid var(--border)' }
                }
              >
                حاضر
              </button>
              <button
                type="button"
                onClick={() => markAttendance(i.id, 'absent')}
                className="status-pill"
                style={
                  i.status === 'absent'
                    ? { background: 'rgba(239, 68, 68, 0.14)', color: 'var(--absent)' }
                    : { background: 'var(--surface)', color: 'var(--text-dim)', border: '1px solid var(--border)' }
                }
              >
                غايب
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
