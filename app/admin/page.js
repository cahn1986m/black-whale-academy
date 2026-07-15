'use client';

import { useEffect, useState } from 'react';
import Header from '../Header';

export default function AdminPage() {
  const [activities, setActivities] = useState([]);
  const [children, setChildren] = useState([]);
  const [activityForm, setActivityForm] = useState({ name: '', emoji: '', instructorName: '', scheduleText: '' });
  const [packageDraft, setPackageDraft] = useState({}); // { [activityId]: { sessionCount, price } }
  const [savingActivity, setSavingActivity] = useState(false);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);

  const [expandedChildId, setExpandedChildId] = useState(null);
  const [childEnrollments, setChildEnrollments] = useState([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [addEnrollActivityId, setAddEnrollActivityId] = useState('');
  const [addEnrollPackageId, setAddEnrollPackageId] = useState('');
  const [renewingActivityId, setRenewingActivityId] = useState(null);
  const [renewPackageId, setRenewPackageId] = useState('');

  const load = async () => {
    const [aRes, cRes] = await Promise.all([
      fetch('/api/activities', { cache: 'no-store' }),
      fetch('/api/child-list', { cache: 'no-store' }),
    ]);
    const aData = await aRes.json();
    const cData = await cRes.json();
    setActivities(aData.activities || []);
    setChildren(cData.children || []);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const addActivity = async (e) => {
    e.preventDefault();
    setError('');
    if (!activityForm.name.trim()) {
      setError('اسم النشاط مطلوب');
      return;
    }
    setSavingActivity(true);
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActivityForm({ name: '', emoji: '', instructorName: '', scheduleText: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingActivity(false);
    }
  };

  const deleteActivity = async (activity) => {
    if (!window.confirm(`حذف "${activity.name}"؟ رح ينحذف معه ${activity.enrolled_count} اشتراك وسجلات الحضور المرتبطة فيه.`)) return;
    const res = await fetch(`/api/activities/${activity.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert('صار خطأ: ' + data.error);
      return;
    }
    load();
    if (expandedChildId) loadEnrollments(expandedChildId);
  };

  const updatePackageDraft = (activityId, field, value) => {
    setPackageDraft((prev) => ({
      ...prev,
      [activityId]: { ...(prev[activityId] || { sessionCount: '', price: '' }), [field]: value },
    }));
  };

  const addPackage = async (activityId) => {
    const draft = packageDraft[activityId] || {};
    const sessionCount = Number(draft.sessionCount);
    const price = Number(draft.price);
    if (!sessionCount || sessionCount <= 0) {
      alert('عدد الحصص مطلوب');
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      alert('السعر مطلوب');
      return;
    }
    const res = await fetch(`/api/activities/${activityId}/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionCount, price }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert('صار خطأ: ' + data.error);
      return;
    }
    setPackageDraft((prev) => ({ ...prev, [activityId]: { sessionCount: '', price: '' } }));
    load();
  };

  const deletePackage = async (pkg) => {
    if (!window.confirm('حذف هالباقة؟')) return;
    const res = await fetch(`/api/packages/${pkg.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert('صار خطأ: ' + data.error);
      return;
    }
    load();
  };

  const loadEnrollments = async (childId) => {
    setLoadingEnrollments(true);
    try {
      const res = await fetch(`/api/children/${childId}/enrollments`, { cache: 'no-store' });
      const data = await res.json();
      setChildEnrollments(data.enrollments || []);
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const toggleExpand = (childId) => {
    if (expandedChildId === childId) {
      setExpandedChildId(null);
      setChildEnrollments([]);
      return;
    }
    setExpandedChildId(childId);
    setAddEnrollActivityId('');
    setAddEnrollPackageId('');
    setRenewingActivityId(null);
    setRenewPackageId('');
    loadEnrollments(childId);
  };

  const addOrRenewEnrollment = async (childId, activityId, packageId) => {
    if (!activityId || !packageId) {
      alert('اختر النشاط والباقة');
      return;
    }
    const res = await fetch(`/api/children/${childId}/enrollments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId: Number(activityId), packageId: Number(packageId) }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert('صار خطأ: ' + data.error);
      return;
    }
    setAddEnrollActivityId('');
    setAddEnrollPackageId('');
    setRenewingActivityId(null);
    setRenewPackageId('');
    loadEnrollments(childId);
    load();
  };

  const unenroll = async (childId, activityId) => {
    if (!window.confirm('إلغاء الاشتراك بهالنشاط؟ رح تنحذف سجلات الحضور المرتبطة فيه.')) return;
    const res = await fetch(`/api/children/${childId}/enrollments?activityId=${activityId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert('صار خطأ: ' + data.error);
      return;
    }
    loadEnrollments(childId);
    load();
  };

  const resetAllData = async () => {
    const typed = window.prompt('هاد الإجراء رح يمسح كل الأطفال والأنشطة والاشتراكات وسجلات الحضور نهائياً ومايمكن التراجع. للتأكيد، اكتب بالضبط: DELETE ALL');
    if (typed !== 'DELETE ALL') {
      if (typed !== null) alert('النص غير مطابق. تم الإلغاء.');
      return;
    }
    setResetting(true);
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE ALL' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('تم حذف كل البيانات بنجاح.');
      setExpandedChildId(null);
      setChildEnrollments([]);
      load();
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  const enrolledActivityIds = new Set(childEnrollments.map((e) => e.activity_id));
  const availableForEnroll = activities.filter((a) => !enrolledActivityIds.has(a.id) && a.packages?.length > 0);
  const packagesForSelectedActivity = activities.find((a) => a.id === Number(addEnrollActivityId))?.packages || [];

  return (
    <div className="page">
      <a href="/" className="back-link">← الرئيسية</a>
      <Header sub="إدارة الأنشطة والأطفال" />

      <div className="card">
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>إضافة نشاط جديد</div>
        {error && <div className="msg error">{error}</div>}
        <form onSubmit={addActivity}>
          <div className="field">
            <label>اسم النشاط</label>
            <input
              type="text"
              value={activityForm.name}
              onChange={(e) => setActivityForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="مثال: السباحة"
            />
          </div>
          <div className="field">
            <label>إيموجي (اختياري)</label>
            <input
              type="text"
              value={activityForm.emoji}
              onChange={(e) => setActivityForm((f) => ({ ...f, emoji: e.target.value }))}
              placeholder="🏊"
            />
          </div>
          <div className="field">
            <label>اسم المدرب/ة (اختياري)</label>
            <input
              type="text"
              value={activityForm.instructorName}
              onChange={(e) => setActivityForm((f) => ({ ...f, instructorName: e.target.value }))}
              placeholder="اسم المدرب"
            />
          </div>
          <div className="field">
            <label>المواعيد (اختياري)</label>
            <input
              type="text"
              value={activityForm.scheduleText}
              onChange={(e) => setActivityForm((f) => ({ ...f, scheduleText: e.target.value }))}
              placeholder="مثال: السبت-الإثنين-الأربعاء 6-9 مساءً"
            />
          </div>
          <button className="btn" type="submit" disabled={savingActivity}>
            {savingActivity ? 'جاري الإضافة...' : 'إضافة النشاط'}
          </button>
        </form>
      </div>

      <div style={{ fontWeight: 'bold', margin: '18px 0 10px' }}>الأنشطة ({activities.length})</div>
      {activities.length === 0 && <div className="empty">لا يوجد أنشطة بعد</div>}
      {activities.map((a) => (
        <div className="card" key={a.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{a.emoji ? `${a.emoji} ` : ''}{a.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                {a.instructor_name || 'بدون مدرب محدد'} — {a.enrolled_count} مشترك
              </div>
              {a.schedule_text && (
                <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>{a.schedule_text}</div>
              )}
            </div>
            <button className="btn ghost" type="button" onClick={() => deleteActivity(a)} style={{ width: 'auto', padding: '8px 12px', fontSize: 12 }}>
              حذف
            </button>
          </div>

          <div className="tabs" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            {a.packages.map((p) => (
              <span className="tab" key={p.id}>
                {p.session_count} حصص · {p.price} درهم{' '}
                <button
                  type="button"
                  onClick={() => deletePackage(p)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginInlineStart: 4 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              type="number"
              min="1"
              placeholder="عدد الحصص"
              value={packageDraft[a.id]?.sessionCount || ''}
              onChange={(e) => updatePackageDraft(a.id, 'sessionCount', e.target.value)}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
            <input
              type="number"
              min="0"
              placeholder="السعر (درهم)"
              value={packageDraft[a.id]?.price || ''}
              onChange={(e) => updatePackageDraft(a.id, 'price', e.target.value)}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
            <button className="btn secondary" type="button" onClick={() => addPackage(a.id)} style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>
              + باقة
            </button>
          </div>
        </div>
      ))}

      <button className="btn secondary" type="button" onClick={load} style={{ marginTop: 8 }}>
        🔄 تحديث القوائم
      </button>
      <button
        className="btn secondary"
        type="button"
        onClick={resetAllData}
        disabled={resetting}
        style={{ marginTop: 8, marginInlineStart: 8, borderColor: 'var(--absent)', color: 'var(--absent)' }}
      >
        {resetting ? 'جاري الحذف...' : '🗑️ حذف كل البيانات'}
      </button>

      <div style={{ fontWeight: 'bold', margin: '22px 0 10px' }}>
        الأطفال المسجلين ({children.length})
      </div>
      {children.length === 0 && <div className="empty">ما في أطفال مسجلين بعد</div>}
      {children.map((c) => (
        <div key={c.id}>
          <div className="child-row" onClick={() => toggleExpand(c.id)} style={{ cursor: 'pointer' }}>
            {c.photo_base64 ? (
              <img src={c.photo_base64} alt={c.full_name} />
            ) : (
              <div className="child-avatar-fallback">🧒</div>
            )}
            <span className="name">{c.full_name}</span>
            <a
              href={`/admin/child/${c.id}`}
              onClick={(e) => e.stopPropagation()}
              className="btn ghost"
              style={{ width: 'auto', padding: '8px 12px', fontSize: 12 }}
            >
              QR
            </a>
          </div>

          {expandedChildId === c.id && (
            <div className="card" style={{ marginTop: -4 }}>
              {loadingEnrollments && <div className="empty">جاري التحميل...</div>}
              {!loadingEnrollments && childEnrollments.length === 0 && (
                <div className="empty">ما في اشتراكات بأنشطة بعد</div>
              )}
              {!loadingEnrollments && childEnrollments.map((e) => {
                const activity = activities.find((a) => a.id === e.activity_id);
                const packages = activity?.packages || [];
                return (
                  <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{e.emoji ? `${e.emoji} ` : ''}{e.activity_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                          {e.sessions_used}/{e.sessions_total} حصة
                          {e.price_paid != null ? ` — ${e.price_paid} درهم` : ''}
                        </div>
                      </div>
                      <span
                        className={`status-pill ${e.sessions_remaining > 0 ? 'present' : 'absent'}`}
                        style={{ marginInlineStart: 'auto', marginInlineEnd: 8 }}
                      >
                        {e.sessions_remaining > 0 ? `متبقي ${e.sessions_remaining}` : 'خلصت الحصص'}
                      </span>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => {
                          setRenewingActivityId(renewingActivityId === e.activity_id ? null : e.activity_id);
                          setRenewPackageId('');
                        }}
                        style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }}
                      >
                        تجديد
                      </button>
                      <button className="btn ghost" type="button" onClick={() => unenroll(c.id, e.activity_id)} style={{ width: 'auto', padding: '6px 10px', fontSize: 11, marginInlineStart: 6 }}>
                        إلغاء
                      </button>
                    </div>
                    {renewingActivityId === e.activity_id && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <select
                          value={renewPackageId}
                          onChange={(ev) => setRenewPackageId(ev.target.value)}
                          style={{ flex: 1 }}
                        >
                          <option value="">اختر باقة التجديد</option>
                          {packages.map((p) => (
                            <option key={p.id} value={p.id}>{p.session_count} حصص — {p.price} درهم</option>
                          ))}
                        </select>
                        <button
                          className="btn secondary"
                          type="button"
                          onClick={() => addOrRenewEnrollment(c.id, e.activity_id, renewPackageId)}
                          style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}
                        >
                          تأكيد
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {availableForEnroll.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-dim)' }}>إضافة اشتراك بنشاط جديد</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select
                      value={addEnrollActivityId}
                      onChange={(e) => { setAddEnrollActivityId(e.target.value); setAddEnrollPackageId(''); }}
                      style={{ flex: 1, minWidth: 120 }}
                    >
                      <option value="">اختر النشاط</option>
                      {availableForEnroll.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <select
                      value={addEnrollPackageId}
                      onChange={(e) => setAddEnrollPackageId(e.target.value)}
                      disabled={!addEnrollActivityId}
                      style={{ flex: 1, minWidth: 120 }}
                    >
                      <option value="">اختر الباقة</option>
                      {packagesForSelectedActivity.map((p) => (
                        <option key={p.id} value={p.id}>{p.session_count} حصص — {p.price} درهم</option>
                      ))}
                    </select>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => addOrRenewEnrollment(c.id, addEnrollActivityId, addEnrollPackageId)}
                      style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}
                    >
                      اشتراك
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
