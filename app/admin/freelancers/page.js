'use client';

import { useEffect, useState } from 'react';
import Header from '../../Header';

const PIN_REGEX = /^\d{4}$/;

const PAYMENT_TYPE_LABELS = {
  prepaid: 'مسبق الدفع',
  monthly: 'شهري',
  on_account: 'على الحساب',
};

function isLocked(lockedUntil) {
  return Boolean(lockedUntil) && new Date(lockedUntil).getTime() > Date.now();
}

export default function AdminFreelancersPage() {
  const [freelancers, setFreelancers] = useState([]);
  const [levelPricing, setLevelPricing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [freelancerForm, setFreelancerForm] = useState({ name: '', phone: '', pin: '' });
  const [savingFreelancer, setSavingFreelancer] = useState(false);
  const [freelancerFormError, setFreelancerFormError] = useState('');

  const [expandedFreelancerId, setExpandedFreelancerId] = useState(null);
  const [freelancerDetail, setFreelancerDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState({});

  const [levelPriceDraft, setLevelPriceDraft] = useState({});

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [fRes, lRes] = await Promise.all([
        fetch('/api/admin/freelancers', { cache: 'no-store' }),
        fetch('/api/admin/level-pricing', { cache: 'no-store' }),
      ]);
      const fData = await fRes.json();
      const lData = await lRes.json();
      if (!fRes.ok) throw new Error(fData.error || 'صار خطأ');
      if (!lRes.ok) throw new Error(lData.error || 'صار خطأ');
      setFreelancers(fData.freelancers);
      setLevelPricing(lData.pricing);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const addFreelancer = async (e) => {
    e.preventDefault();
    setFreelancerFormError('');
    const name = freelancerForm.name.trim();
    const phone = freelancerForm.phone.trim();
    const pin = freelancerForm.pin;

    if (!name || !phone) {
      setFreelancerFormError('الاسم ورقم الجوال مطلوبان');
      return;
    }
    if (!PIN_REGEX.test(pin)) {
      setFreelancerFormError('الرمز يجب أن يكون 4 أرقام بالضبط');
      return;
    }

    setSavingFreelancer(true);
    try {
      const res = await fetch('/api/admin/freelancers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setFreelancers((prev) =>
        [
          ...prev,
          {
            id: data.freelancerId,
            name,
            phone,
            payment_type: 'prepaid',
            is_active: true,
            created_at: new Date().toISOString(),
            current_balance: 0,
          },
        ].sort((a, b) => a.name.localeCompare(b.name))
      );
      setFreelancerForm({ name: '', phone: '', pin: '' });
    } catch (err) {
      setFreelancerFormError(err.message);
    } finally {
      setSavingFreelancer(false);
    }
  };

  const loadFreelancerDetail = async (freelancerId) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/freelancers/${freelancerId}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setFreelancerDetail({ freelancer: data.freelancer, pricingOverrides: data.pricingOverrides });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleExpandFreelancer = (freelancerId) => {
    if (expandedFreelancerId === freelancerId) {
      setExpandedFreelancerId(null);
      setFreelancerDetail(null);
      return;
    }
    setExpandedFreelancerId(freelancerId);
    setFreelancerDetail(null);
    setOverrideDraft({});
    loadFreelancerDetail(freelancerId);
  };

  const toggleActive = async (freelancer) => {
    const nextActive = !freelancer.is_active;
    try {
      const res = await fetch(`/api/admin/freelancers/${freelancer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setFreelancers((prev) => prev.map((f) => (f.id === freelancer.id ? { ...f, is_active: nextActive } : f)));
      setFreelancerDetail((prev) =>
        prev && prev.freelancer.id === freelancer.id
          ? { ...prev, freelancer: { ...prev.freelancer, is_active: nextActive } }
          : prev
      );
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    }
  };

  const changePaymentType = async (freelancerId, paymentType) => {
    try {
      const res = await fetch(`/api/admin/freelancers/${freelancerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_type: paymentType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setFreelancers((prev) => prev.map((f) => (f.id === freelancerId ? { ...f, payment_type: paymentType } : f)));
      setFreelancerDetail((prev) =>
        prev && prev.freelancer.id === freelancerId
          ? { ...prev, freelancer: { ...prev.freelancer, payment_type: paymentType } }
          : prev
      );
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    }
  };

  const resetPin = async (freelancerId) => {
    const newPin = window.prompt('أدخل رمز PIN جديد (4 أرقام)');
    if (newPin === null) return;
    if (!PIN_REGEX.test(newPin)) {
      alert('الرمز يجب أن يكون 4 أرقام بالضبط');
      return;
    }
    try {
      const res = await fetch(`/api/admin/freelancers/${freelancerId}/reset-pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      alert('تم تصفير الرمز بنجاح.');
      setFreelancerDetail((prev) =>
        prev && prev.freelancer.id === freelancerId
          ? { ...prev, freelancer: { ...prev.freelancer, failed_login_attempts: 0, locked_until: null } }
          : prev
      );
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    }
  };

  const savePricingOverride = async (freelancerId, level) => {
    const price = Number(overrideDraft[level]);
    if (!Number.isFinite(price) || price <= 0) {
      alert('السعر يجب أن يكون رقماً موجباً');
      return;
    }
    try {
      const res = await fetch(`/api/admin/freelancers/${freelancerId}/pricing-overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setFreelancerDetail((prev) => {
        if (!prev) return prev;
        const others = prev.pricingOverrides.filter((o) => o.level !== level);
        return { ...prev, pricingOverrides: [...others, { level, price }] };
      });
      setOverrideDraft((prev) => ({ ...prev, [level]: '' }));
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    }
  };

  const deletePricingOverride = async (freelancerId, level) => {
    try {
      const res = await fetch(
        `/api/admin/freelancers/${freelancerId}/pricing-overrides?level=${encodeURIComponent(level)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setFreelancerDetail((prev) =>
        prev ? { ...prev, pricingOverrides: prev.pricingOverrides.filter((o) => o.level !== level) } : prev
      );
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    }
  };

  const saveLevelPrice = async (level) => {
    const current = levelPricing.find((lp) => lp.level === level);
    const price = Number(levelPriceDraft[level] ?? current?.price);
    if (!Number.isFinite(price) || price <= 0) {
      alert('السعر يجب أن يكون رقماً موجباً');
      return;
    }
    try {
      const res = await fetch('/api/admin/level-pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setLevelPricing((prev) => prev.map((lp) => (lp.level === level ? { ...lp, price } : lp)));
      setLevelPriceDraft((prev) => ({ ...prev, [level]: '' }));
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    }
  };

  return (
    <div className="page">
      <a href="/admin" className="back-link">← الإدارة</a>
      <Header sub="إدارة المدربين المستقلين" />
      {error && <div className="msg error">{error}</div>}

      <div className="card">
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>إضافة مدرب جديد</div>
        {freelancerFormError && <div className="msg error">{freelancerFormError}</div>}
        <form onSubmit={addFreelancer}>
          <div className="field">
            <label>الاسم</label>
            <input
              type="text"
              value={freelancerForm.name}
              onChange={(e) => setFreelancerForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="اسم المدرب"
            />
          </div>
          <div className="field">
            <label>رقم الجوال</label>
            <input
              type="tel"
              value={freelancerForm.phone}
              onChange={(e) => setFreelancerForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="05xxxxxxxx"
            />
          </div>
          <div className="field">
            <label>الرمز (PIN)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={freelancerForm.pin}
              onChange={(e) => setFreelancerForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
              placeholder="••••"
            />
          </div>
          <button className="btn" type="submit" disabled={savingFreelancer}>
            {savingFreelancer ? 'جاري الإضافة...' : 'إضافة المدرب'}
          </button>
        </form>
      </div>

      <div style={{ fontWeight: 'bold', margin: '18px 0 10px' }}>المدربون ({freelancers.length})</div>
      {loading && <div className="empty">جاري التحميل...</div>}
      {!loading && freelancers.length === 0 && <div className="empty">ما في مدربين مسجلين بعد</div>}

      {!loading &&
        freelancers.map((f) => (
          <div key={f.id}>
            <div className="child-row" onClick={() => toggleExpandFreelancer(f.id)} style={{ cursor: 'pointer' }}>
              <div className="child-avatar-fallback">👤</div>
              <span className="name">
                {f.name}
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)' }}>{f.phone}</span>
              </span>
              <span
                className={`status-pill ${f.is_active ? 'present' : 'absent'}`}
                style={{ marginInlineEnd: 8 }}
              >
                {f.is_active ? 'نشط' : 'معطّل'}
              </span>
              <span style={{ fontWeight: 'bold', color: Number(f.current_balance) < 0 ? 'var(--absent)' : 'var(--text)' }}>
                {Number(f.current_balance).toFixed(2)}
              </span>
            </div>

            {expandedFreelancerId === f.id && (
              <div className="card" style={{ marginTop: -4 }}>
                {loadingDetail && <div className="empty">جاري التحميل...</div>}

                {!loadingDetail && freelancerDetail && freelancerDetail.freelancer.id === f.id && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>حالة الحساب</span>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => toggleActive(freelancerDetail.freelancer)}
                        style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                      >
                        {freelancerDetail.freelancer.is_active ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                      </button>
                    </div>

                    <div className="field">
                      <label>نوع الدفع</label>
                      <select
                        value={freelancerDetail.freelancer.payment_type}
                        onChange={(e) => changePaymentType(freelancerDetail.freelancer.id, e.target.value)}
                      >
                        {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>

                    {isLocked(freelancerDetail.freelancer.locked_until) && (
                      <div className="msg error">
                        الحساب مقفول لحد {new Date(freelancerDetail.freelancer.locked_until).toLocaleString('ar-EG')}
                      </div>
                    )}

                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => resetPin(freelancerDetail.freelancer.id)}
                    >
                      تصفير PIN
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, marginBottom: 16 }}>
                      هذا الإجراء بيلغي قفل الحساب تلقائياً (لو كان مقفول)
                    </div>

                    <div style={{ fontWeight: 'bold', marginBottom: 8 }}>أسعار خاصة</div>
                    {levelPricing.map((lp) => {
                      const override = freelancerDetail.pricingOverrides.find((o) => o.level === lp.level);
                      return (
                        <div key={lp.level} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13 }}>{lp.level}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                              افتراضي: {lp.price} درهم{override ? ` — خاص: ${override.price} درهم` : ''}
                            </div>
                          </div>
                          <input
                            type="number"
                            min="0"
                            placeholder="سعر خاص"
                            value={overrideDraft[lp.level] ?? ''}
                            onChange={(e) => setOverrideDraft((prev) => ({ ...prev, [lp.level]: e.target.value }))}
                            style={{ width: 100, padding: '6px 8px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                          />
                          <button
                            className="btn secondary"
                            type="button"
                            onClick={() => savePricingOverride(freelancerDetail.freelancer.id, lp.level)}
                            style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}
                          >
                            حفظ
                          </button>
                          {override && (
                            <button
                              className="btn ghost"
                              type="button"
                              onClick={() => deletePricingOverride(freelancerDetail.freelancer.id, lp.level)}
                              style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}
                            >
                              حذف
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        ))}

      <div style={{ fontWeight: 'bold', margin: '22px 0 10px' }}>الأسعار الافتراضية للمستويات</div>
      {levelPricing.map((lp) => (
        <div className="card" key={lp.level}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 'bold' }}>{lp.level}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                min="0"
                value={levelPriceDraft[lp.level] ?? lp.price}
                onChange={(e) => setLevelPriceDraft((prev) => ({ ...prev, [lp.level]: e.target.value }))}
                style={{ width: 100, padding: '6px 8px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
              <button
                className="btn secondary"
                type="button"
                onClick={() => saveLevelPrice(lp.level)}
                style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
