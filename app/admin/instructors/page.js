'use client';

import { useEffect, useState } from 'react';
import Header from '../../Header';

export default function AdminInstructorsPage() {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [instructorForm, setInstructorForm] = useState({
    name: '',
    contact: '',
    pay_type: 'per_session',
    default_rate_per_day: '',
    monthly_salary: '',
    monthly_absence_deduction: '',
  });
  const [savingInstructor, setSavingInstructor] = useState(false);
  const [instructorFormError, setInstructorFormError] = useState('');

  const [expandedInstructorId, setExpandedInstructorId] = useState(null);
  const [instructorDetail, setInstructorDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    contact: '',
    pay_type: 'per_session',
    default_rate_per_day: '',
    monthly_salary: '',
    monthly_absence_deduction: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [issuingSalary, setIssuingSalary] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/instructors', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setInstructors(data.instructors);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const addInstructor = async (e) => {
    e.preventDefault();
    setInstructorFormError('');
    const name = instructorForm.name.trim();
    const contact = instructorForm.contact.trim();
    const payType = instructorForm.pay_type;

    if (!name) {
      setInstructorFormError('اسم المدرب مطلوب');
      return;
    }

    const body = { name, contact, pay_type: payType };

    if (payType === 'per_session') {
      const defaultRatePerDay = Number(instructorForm.default_rate_per_day);
      if (!Number.isFinite(defaultRatePerDay) || defaultRatePerDay <= 0) {
        setInstructorFormError('سعر الحصة لازم يكون رقم أكبر من صفر');
        return;
      }
      body.default_rate_per_day = defaultRatePerDay;
    } else {
      const monthlySalary = Number(instructorForm.monthly_salary);
      if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) {
        setInstructorFormError('الراتب الشهري لازم يكون رقم أكبر من صفر');
        return;
      }
      const monthlyAbsenceDeduction = Number(instructorForm.monthly_absence_deduction);
      if (!Number.isFinite(monthlyAbsenceDeduction) || monthlyAbsenceDeduction <= 0) {
        setInstructorFormError('مبلغ خصم الغياب لازم يكون رقم أكبر من صفر');
        return;
      }
      body.monthly_salary = monthlySalary;
      body.monthly_absence_deduction = monthlyAbsenceDeduction;
    }

    setSavingInstructor(true);
    try {
      const res = await fetch('/api/admin/instructors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setInstructors((prev) =>
        [
          ...prev,
          {
            id: data.instructorId,
            name,
            contact,
            pay_type: payType,
            default_rate_per_day: payType === 'per_session' ? body.default_rate_per_day : null,
            monthly_salary: payType === 'monthly' ? body.monthly_salary : null,
            monthly_absence_deduction: payType === 'monthly' ? body.monthly_absence_deduction : null,
            active: true,
            current_balance: 0,
          },
        ].sort((a, b) => a.name.localeCompare(b.name))
      );
      setInstructorForm({
        name: '',
        contact: '',
        pay_type: 'per_session',
        default_rate_per_day: '',
        monthly_salary: '',
        monthly_absence_deduction: '',
      });
    } catch (err) {
      setInstructorFormError(err.message);
    } finally {
      setSavingInstructor(false);
    }
  };

  const loadInstructorDetail = async (instructorId) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/instructors/${instructorId}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setInstructorDetail({ instructor: data.instructor, linkedActivities: data.linkedActivities });
      setEditForm({
        name: data.instructor.name,
        contact: data.instructor.contact || '',
        pay_type: data.instructor.pay_type,
        default_rate_per_day: data.instructor.default_rate_per_day ?? '',
        monthly_salary: data.instructor.monthly_salary ?? '',
        monthly_absence_deduction: data.instructor.monthly_absence_deduction ?? '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleExpandInstructor = (instructorId) => {
    if (expandedInstructorId === instructorId) {
      setExpandedInstructorId(null);
      setInstructorDetail(null);
      return;
    }
    setExpandedInstructorId(instructorId);
    setInstructorDetail(null);
    loadInstructorDetail(instructorId);
  };

  const toggleActive = async (instructor) => {
    const nextActive = !instructor.active;
    try {
      const res = await fetch(`/api/admin/instructors/${instructor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setInstructors((prev) => prev.map((i) => (i.id === instructor.id ? { ...i, active: nextActive } : i)));
      setInstructorDetail((prev) =>
        prev && prev.instructor.id === instructor.id
          ? { ...prev, instructor: { ...prev.instructor, active: nextActive } }
          : prev
      );
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    }
  };

  const saveEdit = async (instructorId) => {
    const name = editForm.name.trim();
    const contact = editForm.contact.trim();
    const payType = editForm.pay_type;

    if (!name) {
      alert('اسم المدرب مطلوب');
      return;
    }

    const body = { name, contact, pay_type: payType };

    if (payType === 'per_session') {
      const defaultRatePerDay = Number(editForm.default_rate_per_day);
      if (!Number.isFinite(defaultRatePerDay) || defaultRatePerDay <= 0) {
        alert('سعر الحصة لازم يكون رقم أكبر من صفر');
        return;
      }
      body.default_rate_per_day = defaultRatePerDay;
    } else {
      const monthlySalary = Number(editForm.monthly_salary);
      if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) {
        alert('الراتب الشهري لازم يكون رقم أكبر من صفر');
        return;
      }
      const monthlyAbsenceDeduction = Number(editForm.monthly_absence_deduction);
      if (!Number.isFinite(monthlyAbsenceDeduction) || monthlyAbsenceDeduction <= 0) {
        alert('مبلغ خصم الغياب لازم يكون رقم أكبر من صفر');
        return;
      }
      body.monthly_salary = monthlySalary;
      body.monthly_absence_deduction = monthlyAbsenceDeduction;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/instructors/${instructorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      const updatedFields = {
        name,
        contact,
        pay_type: payType,
        default_rate_per_day: payType === 'per_session' ? body.default_rate_per_day : null,
        monthly_salary: payType === 'monthly' ? body.monthly_salary : null,
        monthly_absence_deduction: payType === 'monthly' ? body.monthly_absence_deduction : null,
      };
      setInstructors((prev) =>
        prev
          .map((i) => (i.id === instructorId ? { ...i, ...updatedFields } : i))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setInstructorDetail((prev) =>
        prev && prev.instructor.id === instructorId
          ? { ...prev, instructor: { ...prev.instructor, ...updatedFields } }
          : prev
      );
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const issueSalary = async (instructorId) => {
    setIssuingSalary(true);
    try {
      const res = await fetch(`/api/admin/instructors/${instructorId}/issue-salary`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      alert('تم إصدار الراتب بنجاح');
      loadInstructorDetail(instructorId);
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    } finally {
      setIssuingSalary(false);
    }
  };

  return (
    <div className="page">
      <a href="/admin" className="back-link">← الإدارة</a>
      <Header sub="إدارة المدربين" />
      {error && <div className="msg error">{error}</div>}

      <div className="card">
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>إضافة مدرب جديد</div>
        {instructorFormError && <div className="msg error">{instructorFormError}</div>}
        <form onSubmit={addInstructor}>
          <div className="field">
            <label>الاسم</label>
            <input
              type="text"
              value={instructorForm.name}
              onChange={(e) => setInstructorForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="اسم المدرب"
            />
          </div>
          <div className="field">
            <label>معلومة تواصل (اختياري)</label>
            <input
              type="text"
              value={instructorForm.contact}
              onChange={(e) => setInstructorForm((f) => ({ ...f, contact: e.target.value }))}
              placeholder="رقم جوال أو إيميل"
            />
          </div>
          <div className="field">
            <label>نوع الدفع</label>
            <select
              value={instructorForm.pay_type}
              onChange={(e) => setInstructorForm((f) => ({ ...f, pay_type: e.target.value }))}
            >
              <option value="per_session">بالحصة اليومية</option>
              <option value="monthly">راتب شهري</option>
            </select>
          </div>
          {instructorForm.pay_type === 'per_session' ? (
            <div className="field">
              <label>سعر الحصة اليومية</label>
              <input
                type="number"
                min="0"
                value={instructorForm.default_rate_per_day}
                onChange={(e) => setInstructorForm((f) => ({ ...f, default_rate_per_day: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          ) : (
            <>
              <div className="field">
                <label>الراتب الشهري</label>
                <input
                  type="number"
                  min="0"
                  value={instructorForm.monthly_salary}
                  onChange={(e) => setInstructorForm((f) => ({ ...f, monthly_salary: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="field">
                <label>مبلغ خصم الغياب اليومي</label>
                <input
                  type="number"
                  min="0"
                  value={instructorForm.monthly_absence_deduction}
                  onChange={(e) => setInstructorForm((f) => ({ ...f, monthly_absence_deduction: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </>
          )}
          <button className="btn" type="submit" disabled={savingInstructor}>
            {savingInstructor ? 'جاري الإضافة...' : 'إضافة المدرب'}
          </button>
        </form>
      </div>

      <div style={{ fontWeight: 'bold', margin: '18px 0 10px' }}>المدربون ({instructors.length})</div>
      {loading && <div className="empty">جاري التحميل...</div>}
      {!loading && instructors.length === 0 && <div className="empty">ما في مدربين مسجلين بعد</div>}

      {!loading &&
        instructors.map((i) => (
          <div key={i.id}>
            <div className="child-row" onClick={() => toggleExpandInstructor(i.id)} style={{ cursor: 'pointer' }}>
              <div className="child-avatar-fallback">👤</div>
              <span className="name">{i.name}</span>
              <span
                className={`status-pill ${i.active ? 'present' : 'absent'}`}
                style={{ marginInlineEnd: 8 }}
              >
                {i.active ? 'نشط' : 'معطّل'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', marginInlineEnd: 8 }}>
                {i.pay_type === 'monthly' ? 'شهري' : 'بالحصة'}
              </span>
              <span style={{ fontWeight: 'bold', color: Number(i.current_balance) < 0 ? 'var(--absent)' : 'var(--text)' }}>
                {Number(i.current_balance).toFixed(2)}
              </span>
            </div>

            {expandedInstructorId === i.id && (
              <div className="card" style={{ marginTop: -4 }}>
                {loadingDetail && <div className="empty">جاري التحميل...</div>}

                {!loadingDetail && instructorDetail && instructorDetail.instructor.id === i.id && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>حالة الحساب</span>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => toggleActive(instructorDetail.instructor)}
                        style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                      >
                        {instructorDetail.instructor.active ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                      </button>
                    </div>

                    <div className="field">
                      <label>الاسم</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>معلومة تواصل</label>
                      <input
                        type="text"
                        value={editForm.contact}
                        onChange={(e) => setEditForm((f) => ({ ...f, contact: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>نوع الدفع</label>
                      <select
                        value={editForm.pay_type}
                        onChange={(e) => setEditForm((f) => ({ ...f, pay_type: e.target.value }))}
                      >
                        <option value="per_session">بالحصة اليومية</option>
                        <option value="monthly">راتب شهري</option>
                      </select>
                    </div>
                    {editForm.pay_type === 'per_session' ? (
                      <div className="field">
                        <label>سعر الحصة اليومية</label>
                        <input
                          type="number"
                          min="0"
                          value={editForm.default_rate_per_day}
                          onChange={(e) => setEditForm((f) => ({ ...f, default_rate_per_day: e.target.value }))}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="field">
                          <label>الراتب الشهري</label>
                          <input
                            type="number"
                            min="0"
                            value={editForm.monthly_salary}
                            onChange={(e) => setEditForm((f) => ({ ...f, monthly_salary: e.target.value }))}
                          />
                        </div>
                        <div className="field">
                          <label>مبلغ خصم الغياب اليومي</label>
                          <input
                            type="number"
                            min="0"
                            value={editForm.monthly_absence_deduction}
                            onChange={(e) => setEditForm((f) => ({ ...f, monthly_absence_deduction: e.target.value }))}
                          />
                        </div>
                      </>
                    )}
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => saveEdit(instructorDetail.instructor.id)}
                      disabled={savingEdit}
                    >
                      {savingEdit ? 'جاري الحفظ...' : 'حفظ'}
                    </button>

                    {instructorDetail.instructor.pay_type === 'monthly' && (
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => issueSalary(instructorDetail.instructor.id)}
                        disabled={issuingSalary}
                        style={{ marginTop: 8 }}
                      >
                        {issuingSalary ? 'جاري الإصدار...' : 'إصدار راتب هذا الشهر'}
                      </button>
                    )}

                    <div style={{ fontWeight: 'bold', margin: '18px 0 8px' }}>الأنشطة المرتبطة</div>
                    {instructorDetail.linkedActivities.length === 0 ? (
                      <div className="empty">ما في نشاط مرتبط حالياً</div>
                    ) : (
                      instructorDetail.linkedActivities.map((a) => (
                        <div key={a.id} style={{ fontSize: 13, padding: '6px 0' }}>
                          {a.name}
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
