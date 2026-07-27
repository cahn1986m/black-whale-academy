'use client';

import { useEffect, useState } from 'react';
import Header from '../../Header';

const PIN_REGEX = /^\d{4}$/;

const PAYMENT_TYPE_LABELS = {
  prepaid: 'مسبق الدفع',
  monthly: 'شهري',
  on_account: 'على الحساب',
};

const ENTRY_TYPE_LABELS = {
  payment: 'دفعة',
  session_charge: 'تحصيل جلسة',
  no_show_fee: 'غرامة غياب',
  reversal: 'عكس حركة',
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
  const [freelancerLedger, setFreelancerLedger] = useState(null);

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentFormError, setPaymentFormError] = useState('');

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
      const [detailRes, ledgerRes] = await Promise.all([
        fetch(`/api/admin/freelancers/${freelancerId}`, { cache: 'no-store' }),
        fetch(`/api/admin/freelancers/${freelancerId}/ledger`, { cache: 'no-store' }),
      ]);
      const detailData = await detailRes.json();
      const ledgerData = await ledgerRes.json();
      if (!detailRes.ok) throw new Error(detailData.error || 'صار خطأ');
      if (!ledgerRes.ok) throw new Error(ledgerData.error || 'صار خطأ');
      setFreelancerDetail({ freelancer: detailData.freelancer, pricingOverrides: detailData.pricingOverrides });
      setFreelancerLedger({ entries: ledgerData.entries, currentBalance: ledgerData.currentBalance });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadLedger = async (freelancerId) => {
    try {
      const res = await fetch(`/api/admin/freelancers/${freelancerId}/ledger`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setFreelancerLedger({ entries: data.entries, currentBalance: data.currentBalance });
      setFreelancers((prev) =>
        prev.map((f) => (f.id === freelancerId ? { ...f, current_balance: data.currentBalance } : f))
      );
      setFreelancerDetail((prev) =>
        prev && prev.freelancer.id === freelancerId
          ? { ...prev, freelancer: { ...prev.freelancer, current_balance: data.currentBalance } }
          : prev
      );
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    }
  };

  const toggleExpandFreelancer = (freelancerId) => {
    if (expandedFreelancerId === freelancerId) {
      setExpandedFreelancerId(null);
      setFreelancerDetail(null);
      setFreelancerLedger(null);
      return;
    }
    setExpandedFreelancerId(freelancerId);
    setFreelancerDetail(null);
    setFreelancerLedger(null);
    setOverrideDraft({});
    setShowPaymentForm(false);
    setPaymentDirection('');
    setPaymentAmount('');
    setPaymentNote('');
    setPaymentFormError('');
    loadFreelancerDetail(freelancerId);
  };

  const reverseEntry = async (freelancerId, entry) => {
    const reason = window.prompt('اكتب سبب عكس هالحركة');
    if (reason === null) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) return;
    try {
      const res = await fetch(`/api/admin/freelancers/${freelancerId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryType: 'reversal',
          amount: -1 * Number(entry.amount),
          note: trimmedReason,
          reversedEntryId: entry.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      loadLedger(freelancerId);
    } catch (err) {
      alert('صار خطأ: ' + err.message);
    }
  };

  const savePayment = async (freelancerId) => {
    setPaymentFormError('');
    if (paymentDirection !== 'in' && paymentDirection !== 'out') {
      setPaymentFormError('اختر اتجاه الحركة');
      return;
    }
    const amountValue = Number(paymentAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setPaymentFormError('المبلغ يجب أن يكون رقماً موجباً');
      return;
    }
    const trimmedNote = paymentNote.trim();
    if (!trimmedNote) {
      setPaymentFormError('الملاحظة مطلوبة');
      return;
    }
    const signedAmount = paymentDirection === 'in' ? amountValue : -amountValue;
    setSavingPayment(true);
    try {
      const res = await fetch(`/api/admin/freelancers/${freelancerId}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryType: 'payment', amount: signedAmount, note: trimmedNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setPaymentDirection('');
      setPaymentAmount('');
      setPaymentNote('');
      setShowPaymentForm(false);
      loadLedger(freelancerId);
    } catch (err) {
      setPaymentFormError(err.message);
    } finally {
      setSavingPayment(false);
    }
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

                    <div style={{ fontWeight: 'bold', margin: '18px 0 8px' }}>السجل المالي</div>

                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => setShowPaymentForm((v) => !v)}
                      style={{ marginBottom: 12 }}
                    >
                      ➕ تسجيل دفعة
                    </button>

                    {showPaymentForm && (
                      <div className="card">
                        {paymentFormError && <div className="msg error">{paymentFormError}</div>}
                        <div className="field">
                          <label>الاتجاه</label>
                          <select
                            value={paymentDirection}
                            onChange={(e) => setPaymentDirection(e.target.value)}
                          >
                            <option value="">اختر الاتجاه</option>
                            <option value="in">دفعة واردة من المدرب (تزيد رصيده)</option>
                            <option value="out">دفعة صادرة له / تصحيح (تنقص رصيده)</option>
                          </select>
                        </div>
                        <div className="field">
                          <label>المبلغ</label>
                          <input
                            type="number"
                            min="0"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="field">
                          <label>الملاحظة</label>
                          <input
                            type="text"
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                            placeholder="سبب الدفعة"
                          />
                        </div>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => savePayment(freelancerDetail.freelancer.id)}
                          disabled={savingPayment}
                        >
                          {savingPayment ? 'جاري الحفظ...' : 'حفظ'}
                        </button>
                      </div>
                    )}

                    {!freelancerLedger && <div className="empty">جاري التحميل...</div>}
                    {freelancerLedger && freelancerLedger.entries.length === 0 && (
                      <div className="empty">ما في حركات بعد</div>
                    )}
                    {freelancerLedger && freelancerLedger.entries.length > 0 && (() => {
                      const reversedIds = new Set(
                        freelancerLedger.entries
                          .filter((e) => e.reversed_entry_id != null)
                          .map((e) => e.reversed_entry_id)
                      );
                      return freelancerLedger.entries.map((entry) => (
                        <div className="card" key={entry.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 'bold' }}>{ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                                {new Date(entry.created_at).toLocaleString('ar-EG', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                            <div
                              style={{
                                fontWeight: 'bold',
                                fontSize: 16,
                                color: Number(entry.amount) < 0 ? 'var(--absent)' : 'var(--present)',
                              }}
                            >
                              {Number(entry.amount).toFixed(2)}
                            </div>
                          </div>

                          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
                            الرصيد بعد الحركة: {Number(entry.balance_after).toFixed(2)}
                          </div>

                          {entry.note && (
                            <div style={{ fontSize: 13, marginTop: 8 }}>{entry.note}</div>
                          )}

                          {!reversedIds.has(entry.id) && (
                            <button
                              className="btn ghost"
                              type="button"
                              onClick={() => reverseEntry(freelancerDetail.freelancer.id, entry)}
                              style={{ width: 'auto', padding: '6px 10px', fontSize: 12, marginTop: 8 }}
                            >
                              عكس
                            </button>
                          )}
                        </div>
                      ));
                    })()}
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
