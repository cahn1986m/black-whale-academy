'use client';

import { useEffect, useState } from 'react';
import Header from '../../Header';
import { useTranslations } from '@/lib/locale/LocaleContext';

export default function StaffInstructorAttendancePage() {
  const t = useTranslations('staff');
  const tc = useTranslations('common');
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/staff/instructor-attendance', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || tc('error'));
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
      if (!res.ok) throw new Error(data.error || tc('error'));
      setInstructors((prev) => prev.map((i) => (i.id === instructorId ? { ...i, status } : i)));
    } catch (err) {
      alert(`${tc('error')}: ${err.message}`);
    }
  };

  return (
    <div className="page">
      <a href="/staff" className="back-link">← {t('backStaffPortal')}</a>
      <Header sub={t('instructorAttendanceSub')} />
      {error && <div className="msg error">{error}</div>}

      {loading && <div className="empty">{tc('loading')}</div>}
      {!loading && instructors.length === 0 && <div className="empty">{t('noActiveInstructors')}</div>}

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
                {t('present')}
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
                {t('absent')}
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
