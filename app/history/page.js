'use client';

import { useEffect, useState } from 'react';
import Header from '../Header';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function HistoryPage() {
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then((data) => setGroups(data.groups || []));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, groupId]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (groupId) params.set('groupId', groupId);
      const res = await fetch(`/api/attendance?${params.toString()}`);
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
        <label>المجموعة</label>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">كل المجموعات</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
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
        <div className="child-row" key={r.child_id}>
          {r.photo_base64 ? (
            <img src={r.photo_base64} alt={r.full_name} />
          ) : (
            <div className="child-avatar-fallback">🧒</div>
          )}
          <span className="name">{r.full_name}</span>
          <span className={`status-pill ${r.status === 'present' ? 'present' : 'absent'}`}>
            {r.status === 'present' ? 'حاضر' : 'غايب'}
          </span>
        </div>
      ))}
    </div>
  );
}
