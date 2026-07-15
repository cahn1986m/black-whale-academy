'use client';

import { useEffect, useState } from 'react';
import Header from '../Header';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function HistoryPage() {
  const [activities, setActivities] = useState([]);
  const [activityId, setActivityId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/activities', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setActivities(data.activities || []));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, activityId]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (activityId) params.set('activityId', activityId);
      const res = await fetch(`/api/attendance?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      setRecords(data.records || []);
    } finally {
      setLoading(false);
    }
  };

  const presentCount = records.filter((r) => r.status === 'present').length;

  return (
    <div className="page">
      <a href="/" className="back-link">← الرئيسية</a>
      <Header sub="سجل الحضور" />

      <div className="field">
        <label>التاريخ</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text)',
          }}
        />
      </div>

      <div className="field">
        <label>النشاط</label>
        <select value={activityId} onChange={(e) => setActivityId(e.target.value)}>
          <option value="">كل الأنشطة</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>{a.emoji ? `${a.emoji} ` : ''}{a.name}</option>
          ))}
        </select>
      </div>

      <div className="summary-bar">
        <span>الحاضرين</span>
        <span className="count">{presentCount} / {records.length}</span>
      </div>

      {loading && <div className="empty">جاري التحميل...</div>}
      {!loading && records.length === 0 && <div className="empty">ما في بيانات لهاليوم</div>}
      {records.map((r) => (
        <div className="child-row" key={r.enrollment_id}>
          {r.photo_base64 ? (
            <img src={r.photo_base64} alt={r.full_name} />
          ) : (
            <div className="child-avatar-fallback">🧒</div>
          )}
          <span className="name">
            {r.full_name}
            {!activityId && r.activity_name && (
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)' }}>{r.activity_name}</span>
            )}
          </span>
          <span className={`status-pill ${r.status === 'present' ? 'present' : 'absent'}`}>
            {r.status === 'present' ? 'حاضر' : 'غايب'}
          </span>
        </div>
      ))}
    </div>
  );
}
