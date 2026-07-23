'use client';

import { useEffect, useState } from 'react';
import Header from '../Header';

const DEFAULT_ACTIVITIES = [
  {
    name: 'السباحة',
    emoji: '🏊',
    scheduleText: 'يومياً 4:00–9:00 مساءً، السبت والأحد 9:00 صباحاً–2:00 ظهراً',
    packages: [{ sessionCount: 8, price: 300 }, { sessionCount: 12, price: 400 }],
  },
  {
    name: 'Baby Swimming',
    emoji: '👶',
    scheduleText: 'من عمر 6 أشهر فأكثر — مدة الحصة 30 دقيقة',
    packages: [{ sessionCount: 8, price: 599 }],
  },
  {
    name: 'كرة القدم',
    emoji: '⚽',
    scheduleText: 'السبت-الإثنين-الأربعاء 6:00–9:00 مساءً (ساعة لكل مجموعة)',
    packages: [],
  },
  {
    name: 'كرة السلة',
    emoji: '🏀',
    scheduleText: 'السبت-الإثنين-الأربعاء 6:00–9:00 مساءً (ساعة لكل مجموعة)',
    packages: [{ sessionCount: 12, price: 250 }],
  },
  {
    name: 'الجمباز',
    emoji: '🤸',
    scheduleText: 'السبت-الإثنين-الأربعاء',
    packages: [{ sessionCount: 8, price: 250 }],
  },
  {
    name: 'الكاراتيه',
    emoji: '🥋',
    scheduleText: 'الأحد-الثلاثاء-الخميس',
    packages: [{ sessionCount: 12, price: 250 }],
  },
  {
    name: 'الكيك بوكسينج',
    emoji: '🥊',
    scheduleText: 'السبت-الإثنين-الأربعاء',
    packages: [{ sessionCount: 12, price: 300 }],
  },
];

export default function AdminPage() {
  const [activities, setActivities] = useState([]);
  const [children, setChildren] = useState([]);
  const [activityForm, setActivityForm] = useState({ name: '', emoji: '', instructorName: '', scheduleText: '' });
  const [packageDraft, setPackageDraft] = useState({}); // { [activityId]: { sessionCount, price } }
  const [savingActivity, setSavingActivity] = useState(false);
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resettingFreelancers, setResettingFreelancers] = useState(false);

  const [expandedChildId, setExpandedChildId] = useState(null);
  const [childEnrollments, setChildEnrollments] = useState([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [addEnrollActivityId, setAddEnrollActivityId] = useState('');
  const [addEnrollPackageId, setAddEnrollPackageId] = useState('');
  const [renewingActivityId, setRenewingActivityId] = useState(null);
  const [renewPackageId, setRenewPackageId] = useState('');
  const [editingOffsetActivityId, setEditingOffsetActivityId] = useState(null);
  const [offsetDraft, setOffsetDraft] = useState('');

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

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

  const seedDefaultActivities = async () => {
    const existingNames = new Set(activities.map((a) => a.name));
    const toCreate = DEFAULT_ACTIVITIES.filter((a) => !existingNames.has(a.name));
    if (toCreate.length === 0) {
      alert('كل الأنشطة السبعة موجودة أصلاً.');
      return;
    }
    if (!window.confirm(`رح تنضاف ${toCreate.length} أنشطة (مع باقاتها) دفعة وحدة. أكمل؟`)) return;

    setSeeding(true);
    try {
      for (const def of toCreate) {
        const res = await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: def.name, emoji: def.emoji, scheduleText: def.scheduleText }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(`صار خطأ بإضافة "${def.name}": ${data.error}`);
          continue;
        }
        for (const pkg of def.packages) {
          await fetch(`/api/activities/${data.activity.id}/packages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionCount: pkg.sessionCount, price: pkg.price }),
          });
        }
      }
      load();
    } finally {
      setSeeding(false);
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

  const saveOffset = async (childId, activityId) => {
    const sessionsUsedOffset = Number(offsetDraft);
    if (Number.isNaN(sessionsUsedOffset) || sessionsUsedOffset < 0) {
      alert('عدد الحصص غير صحيح');
      return;
    }
    const res = await fetch(`/api/children/${childId}/enrollments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId, sessionsUsedOffset }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert('صار خطأ: ' + data.error);
      return;
    }
    setEditingOffsetActivityId(null);
    loadEnrollments(childId);
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

  const resetFreelancerTestData = async () => {
    const sure = window.confirm(
      'هاد الإجراء رح يحذف نهائياً كل بيانات Freelancers التجريبية: المدربين، الجلسات، الحجوزات، الكشوفات المالية، والإشعارات — بدون رجعة.\n\nالأسعار الافتراضية والإعدادات العامة رح تضل موجودة.\n\nمتأكد بدك تكمل؟'
    );
    if (!sure) return;

    const resetPassword = window.prompt('أدخل كلمة مرور تصفير بيانات Freelancers للتأكيد:');
    if (resetPassword === null) return;
    if (!resetPassword) {
      alert('كلمة المرور مطلوبة. تم الإلغاء.');
      return;
    }

    setResettingFreelancers(true);
    try {
      const res = await fetch('/api/admin/reset-freelancer-test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      alert('تم تصفير بيانات Freelancers التجريبية بنجاح.');
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    } finally {
      setResettingFreelancers(false);
    }
  };

  const logout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' });
    window.location.href = '/';
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword !== confirmPassword) {
      setPasswordError('كلمة المرور الجديدة وتأكيدها مش متطابقين');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch('/api/admin-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('تم تغيير كلمة المرور بنجاح.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const enrolledActivityIds = new Set(childEnrollments.map((e) => e.activity_id));
  const availableForEnroll = activities.filter((a) => !enrolledActivityIds.has(a.id) && a.packages?.length > 0);
  const packagesForSelectedActivity = activities.find((a) => a.id === Number(addEnrollActivityId))?.packages || [];

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" className="back-link" style={{ marginBottom: 0 }}>← الرئيسية</a>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setShowPasswordForm((v) => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer' }}
          >
            🔑 تغيير كلمة المرور
          </button>
          <button
            type="button"
            onClick={logout}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer' }}
          >
            تسجيل الخروج ⏻
          </button>
        </div>
      </div>

      {showPasswordForm && (
        <div className="card">
          <div style={{ fontWeight: 'bold', marginBottom: 12 }}>تغيير كلمة المرور</div>
          {passwordError && <div className="msg error">{passwordError}</div>}
          <form onSubmit={changePassword}>
            <div className="field">
              <label>كلمة المرور الحالية</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="field">
              <label>كلمة المرور الجديدة</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="field">
              <label>تأكيد كلمة المرور الجديدة</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button className="btn" type="submit" disabled={savingPassword}>
              {savingPassword ? 'جاري الحفظ...' : 'حفظ كلمة المرور الجديدة'}
            </button>
          </form>
        </div>
      )}

      <Header sub="إدارة الأنشطة والأطفال" />

      <button
        className="btn secondary"
        type="button"
        onClick={seedDefaultActivities}
        disabled={seeding}
        style={{ marginBottom: 14 }}
      >
        {seeding ? 'جاري التعبئة...' : '🚀 تعبئة الأنشطة السبعة تلقائياً (من الإعلان)'}
      </button>

      <div className="card">
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>إضافة نشاط جديد</div>
        {error && <div className="msg error">{error}</div>}
        <form onSubmit={addActivity}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>اسم النشاط</label>
              <input
                type="text"
                value={activityForm.name}
                onChange={(e) => setActivityForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="مثال: السباحة"
              />
            </div>
            <div className="field" style={{ width: 70 }}>
              <label>إيموجي</label>
              <input
                type="text"
                value={activityForm.emoji}
                onChange={(e) => setActivityForm((f) => ({ ...f, emoji: e.target.value }))}
                placeholder="🏊"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowActivityDetails((v) => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, padding: 0, marginBottom: 12, cursor: 'pointer' }}
          >
            {showActivityDetails ? '− إخفاء التفاصيل الإضافية' : '+ تفاصيل إضافية (المدرب، المواعيد)'}
          </button>

          {showActivityDetails && (
            <>
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
            </>
          )}

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
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => {
                          const next = editingOffsetActivityId === e.activity_id ? null : e.activity_id;
                          setEditingOffsetActivityId(next);
                          setOffsetDraft(next ? String(e.sessions_used_offset) : '');
                        }}
                        style={{ width: 'auto', padding: '6px 10px', fontSize: 11, marginInlineStart: 6 }}
                      >
                        تفقد يدوي
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
                    {editingOffsetActivityId === e.activity_id && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>
                          عدد الحصص يلي حضرها الطفل يدوياً (تفقد ورقي) قبل استخدام النظام — بتنضاف على أي حصص متسجّلة عبر مسح QR
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="number"
                            min="0"
                            value={offsetDraft}
                            onChange={(ev) => setOffsetDraft(ev.target.value)}
                            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                          />
                          <button
                            className="btn secondary"
                            type="button"
                            onClick={() => saveOffset(c.id, e.activity_id)}
                            style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}
                          >
                            حفظ
                          </button>
                        </div>
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

      <div className="card" style={{ marginTop: 22, borderColor: 'var(--absent)' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 8, color: 'var(--absent)' }}>⚠️ منطقة خطر — Freelancers</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
          يحذف نهائيًا كل بيانات وحدة Freelancers التجريبية (المدربين، الجلسات، الحجوزات، الكشوفات المالية، الإشعارات). الأسعار الافتراضية والإعدادات العامة ما بتتأثر.
        </div>
        <button
          className="btn secondary"
          type="button"
          onClick={resetFreelancerTestData}
          disabled={resettingFreelancers}
          style={{ borderColor: 'var(--absent)', color: 'var(--absent)' }}
        >
          {resettingFreelancers ? 'جاري التصفير...' : 'تصفير بيانات Freelancers التجريبية'}
        </button>
      </div>
    </div>
  );
}
