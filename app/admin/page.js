'use client';

import { useEffect, useState } from 'react';
import Header from '../Header';

export default function AdminPage() {
  const [groups, setGroups] = useState([]);
  const [children, setChildren] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [gRes, cRes] = await Promise.all([fetch('/api/groups'), fetch('/api/children')]);
    const gData = await gRes.json();
    const cData = await cRes.json();
    setGroups(gData.groups || []);
    setChildren(cData.children || []);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const addGroup = async (e) => {
    e.preventDefault();
    setError('');
    if (!groupName.trim()) {
      setError('اسم المجموعة مطلوب');
      return;
    }
    setSavingGroup(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, supervisorName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGroupName('');
      setSupervisorName('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingGroup(false);
    }
  };

  const assignGroup = async (childId, newGroupId) => {
    await fetch(`/api/children/${childId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: newGroupId || null }),
    });
    load();
  };

  const unassigned = children.filter((c) => !c.group_id);

  return (
    <div className="page">
      <a href="/" className="back-link">← الرئيسية</a>
      <Header sub="إدارة المجموعات والأطفال" />

      <div className="card">
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>إضافة مجموعة جديدة</div>
        {error && <div className="msg error">{error}</div>}
        <form onSubmit={addGroup}>
          <div className="field">
            <label>اسم المجموعة</label>
            <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="مثال: مجموعة الفراشات" />
          </div>
          <div className="field">
            <label>اسم المشرف/ة</label>
            <input type="text" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} placeholder="اسم المشرف" />
          </div>
          <button className="btn" type="submit" disabled={savingGroup}>
            {savingGroup ? 'جاري الإضافة...' : 'إضافة المجموعة'}
          </button>
        </form>
      </div>

      <div style={{ fontWeight: 'bold', margin: '18px 0 10px' }}>المجموعات ({groups.length})</div>
      {groups.length === 0 && <div className="empty">لا يوجد مجموعات بعد</div>}
      {groups.map((g) => (
        <div className="card" key={g.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{g.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                {g.supervisor_name || 'بدون مشرف محدد'} — {g.children_count} طفل
              </div>
            </div>
          </div>
        </div>
      ))}

      <button className="btn secondary" type="button" onClick={load} style={{ marginTop: 8 }}>
        🔄 تحديث القوائم
      </button>

      <div style={{ fontWeight: 'bold', margin: '22px 0 10px' }}>
        الأطفال المسجلين ({children.length})
        {unassigned.length > 0 && (
          <span style={{ color: 'var(--absent)', fontWeight: 'normal', fontSize: 13 }}>
            {' '}— {unassigned.length} بدون مجموعة
          </span>
        )}
      </div>
      {children.length === 0 && <div className="empty">ما في أطفال مسجلين بعد</div>}
      {children.map((c) => (
        <div className="child-row" key={c.id}>
          {c.photo_base64 ? (
            <img src={c.photo_base64} alt={c.full_name} />
          ) : (
            <div className="child-avatar-fallback">🧒</div>
          )}
          <span className="name">{c.full_name}</span>
          <select
            value={c.group_id || ''}
            onChange={(e) => assignGroup(c.id, e.target.value)}
            style={{ maxWidth: 130, padding: '6px 8px', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <option value="">بدون مجموعة</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <a href={`/admin/child/${c.id}`} className="btn ghost" style={{ width: 'auto', padding: '8px 12px', fontSize: 12 }}>
            QR
          </a>
        </div>
      ))}
    </div>
  );
}
