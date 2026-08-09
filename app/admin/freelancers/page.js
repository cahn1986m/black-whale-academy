'use client';

import { useEffect, useState } from 'react';
import Header from '../../Header';
import { useLocale, useTranslations } from '@/lib/locale/LocaleContext';

const PIN_REGEX = /^\d{4}$/;

function isLocked(lockedUntil) {
  return Boolean(lockedUntil) && new Date(lockedUntil).getTime() > Date.now();
}

export default function AdminFreelancersPage() {
  const { locale } = useLocale();
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const dateLocale = locale === 'en' ? 'en-US' : 'ar-EG';

  const PAYMENT_TYPE_LABELS = {
    prepaid: t('paymentTypePrepaid'),
    monthly: t('paymentTypeMonthly'),
    on_account: t('paymentTypeOnAccount'),
  };
  const ENTRY_TYPE_LABELS = {
    payment: t('entryPayment'),
    session_charge: t('entrySessionCharge'),
    no_show_fee: t('entryNoShowFee'),
    reversal: t('entryReversal'),
  };

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
      if (!fRes.ok) throw new Error(fData.error || tc('error'));
      if (!lRes.ok) throw new Error(lData.error || tc('error'));
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
      setFreelancerFormError(t('nameAndPhoneRequired'));
      return;
    }
    if (!PIN_REGEX.test(pin)) {
      setFreelancerFormError(t('pinMustBe4Digits'));
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
      if (!res.ok) throw new Error(data.error || tc('error'));
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
      if (!detailRes.ok) throw new Error(detailData.error || tc('error'));
      if (!ledgerRes.ok) throw new Error(ledgerData.error || tc('error'));
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
      if (!res.ok) throw new Error(data.error || tc('error'));
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
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
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
    const reason = window.prompt(t('reverseReasonPrompt'));
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
      if (!res.ok) throw new Error(data.error || tc('error'));
      loadLedger(freelancerId);
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    }
  };

  const savePayment = async (freelancerId) => {
    setPaymentFormError('');
    if (paymentDirection !== 'in' && paymentDirection !== 'out') {
      setPaymentFormError(t('directionRequired'));
      return;
    }
    const amountValue = Number(paymentAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setPaymentFormError(t('amountMustBePositive'));
      return;
    }
    const trimmedNote = paymentNote.trim();
    if (!trimmedNote) {
      setPaymentFormError(t('noteRequired'));
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
      if (!res.ok) throw new Error(data.error || tc('error'));
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
    let deactivationReason = null;

    if (!nextActive) {
      const reason = window.prompt(t('deactivationReasonPrompt'));
      if (reason === null) return;
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        alert(t('deactivationReasonRequired'));
        return;
      }
      deactivationReason = trimmedReason;
    }

    try {
      const res = await fetch(`/api/admin/freelancers/${freelancer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive, deactivation_reason: deactivationReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setFreelancers((prev) => prev.map((f) => (f.id === freelancer.id ? { ...f, is_active: nextActive, deactivation_reason: deactivationReason } : f)));
      setFreelancerDetail((prev) =>
        prev && prev.freelancer.id === freelancer.id
          ? { ...prev, freelancer: { ...prev.freelancer, is_active: nextActive, deactivation_reason: deactivationReason } }
          : prev
      );
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
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
      if (!res.ok) throw new Error(data.error || tc('error'));
      setFreelancers((prev) => prev.map((f) => (f.id === freelancerId ? { ...f, payment_type: paymentType } : f)));
      setFreelancerDetail((prev) =>
        prev && prev.freelancer.id === freelancerId
          ? { ...prev, freelancer: { ...prev.freelancer, payment_type: paymentType } }
          : prev
      );
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    }
  };

  const resetPin = async (freelancerId) => {
    const newPin = window.prompt(t('newPinPrompt'));
    if (newPin === null) return;
    if (!PIN_REGEX.test(newPin)) {
      alert(t('pinMustBe4Digits'));
      return;
    }
    try {
      const res = await fetch(`/api/admin/freelancers/${freelancerId}/reset-pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      alert(t('pinResetSuccess'));
      setFreelancerDetail((prev) =>
        prev && prev.freelancer.id === freelancerId
          ? { ...prev, freelancer: { ...prev.freelancer, failed_login_attempts: 0, locked_until: null } }
          : prev
      );
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    }
  };

  const savePricingOverride = async (freelancerId, level) => {
    const price = Number(overrideDraft[level]);
    if (!Number.isFinite(price) || price <= 0) {
      alert(t('priceMustBePositive'));
      return;
    }
    try {
      const res = await fetch(`/api/admin/freelancers/${freelancerId}/pricing-overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setFreelancerDetail((prev) => {
        if (!prev) return prev;
        const others = prev.pricingOverrides.filter((o) => o.level !== level);
        return { ...prev, pricingOverrides: [...others, { level, price }] };
      });
      setOverrideDraft((prev) => ({ ...prev, [level]: '' }));
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    }
  };

  const deletePricingOverride = async (freelancerId, level) => {
    try {
      const res = await fetch(
        `/api/admin/freelancers/${freelancerId}/pricing-overrides?level=${encodeURIComponent(level)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setFreelancerDetail((prev) =>
        prev ? { ...prev, pricingOverrides: prev.pricingOverrides.filter((o) => o.level !== level) } : prev
      );
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    }
  };

  const saveLevelPrice = async (level) => {
    const current = levelPricing.find((lp) => lp.level === level);
    const price = Number(levelPriceDraft[level] ?? current?.price);
    if (!Number.isFinite(price) || price <= 0) {
      alert(t('priceMustBePositive'));
      return;
    }
    try {
      const res = await fetch('/api/admin/level-pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setLevelPricing((prev) => prev.map((lp) => (lp.level === level ? { ...lp, price } : lp)));
      setLevelPriceDraft((prev) => ({ ...prev, [level]: '' }));
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    }
  };

  return (
    <div className="page">
      <a href="/admin" className="back-link">← {t('backToManagement')}</a>
      <Header sub={t('manageFreelancersSub')} />
      {error && <div className="msg error">{error}</div>}

      <div className="card">
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>{t('addNewFreelancer')}</div>
        {freelancerFormError && <div className="msg error">{freelancerFormError}</div>}
        <form onSubmit={addFreelancer}>
          <div className="field">
            <label>{t('nameLabel')}</label>
            <input
              type="text"
              value={freelancerForm.name}
              onChange={(e) => setFreelancerForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('nameLabel')}
            />
          </div>
          <div className="field">
            <label>{t('phoneLabel')}</label>
            <input
              type="tel"
              value={freelancerForm.phone}
              onChange={(e) => setFreelancerForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="05xxxxxxxx"
            />
          </div>
          <div className="field">
            <label>{t('pinLabel')}</label>
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
            {savingFreelancer ? t('adding') : t('addNewFreelancer')}
          </button>
        </form>
      </div>

      <div style={{ fontWeight: 'bold', margin: '18px 0 10px' }}>{t('freelancersCount', { count: freelancers.length })}</div>
      {loading && <div className="empty">{tc('loading')}</div>}
      {!loading && freelancers.length === 0 && <div className="empty">{t('noFreelancersYet')}</div>}

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
                {f.is_active ? t('active') : t('disabled')}
              </span>
              <span style={{ fontWeight: 'bold', color: Number(f.current_balance) < 0 ? 'var(--absent)' : 'var(--text)' }}>
                {Number(f.current_balance).toFixed(2)}
              </span>
            </div>

            {expandedFreelancerId === f.id && (
              <div className="card" style={{ marginTop: -4 }}>
                {loadingDetail && <div className="empty">{tc('loading')}</div>}

                {!loadingDetail && freelancerDetail && freelancerDetail.freelancer.id === f.id && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{t('accountStatus')}</span>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => toggleActive(freelancerDetail.freelancer)}
                        style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                      >
                        {freelancerDetail.freelancer.is_active ? t('disableAccount') : t('enableAccount')}
                      </button>
                    </div>
                    {!freelancerDetail.freelancer.is_active && freelancerDetail.freelancer.deactivation_reason && (
                      <div style={{ fontSize: 12, color: '#b45309', marginBottom: 12 }}>
                        {t('deactivationReasonLine', { reason: freelancerDetail.freelancer.deactivation_reason })}
                      </div>
                    )}

                    <div className="field">
                      <label>{t('paymentTypeLabel')}</label>
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
                        {t('accountLockedUntil', { until: new Date(freelancerDetail.freelancer.locked_until).toLocaleString(dateLocale) })}
                      </div>
                    )}

                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => resetPin(freelancerDetail.freelancer.id)}
                    >
                      {t('resetPin')}
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, marginBottom: 16 }}>
                      {t('resetPinAutoUnlocksNote')}
                    </div>

                    <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{t('specialPricing')}</div>
                    {levelPricing.map((lp) => {
                      const override = freelancerDetail.pricingOverrides.find((o) => o.level === lp.level);
                      return (
                        <div key={lp.level} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13 }}>{lp.level}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                              {t('defaultPriceLine', { price: lp.price })}{override ? t('specialPriceSuffix', { price: override.price }) : ''}
                            </div>
                          </div>
                          <input
                            type="number"
                            min="0"
                            placeholder={t('specialPricePlaceholder')}
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
                            {t('save')}
                          </button>
                          {override && (
                            <button
                              className="btn ghost"
                              type="button"
                              onClick={() => deletePricingOverride(freelancerDetail.freelancer.id, lp.level)}
                              style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}
                            >
                              {tc('delete')}
                            </button>
                          )}
                        </div>
                      );
                    })}

                    <div style={{ fontWeight: 'bold', margin: '18px 0 8px' }}>{t('financialRecord')}</div>

                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => setShowPaymentForm((v) => !v)}
                      style={{ marginBottom: 12 }}
                    >
                      {t('recordPayment')}
                    </button>

                    {showPaymentForm && (
                      <div className="card">
                        {paymentFormError && <div className="msg error">{paymentFormError}</div>}
                        <div className="field">
                          <label>{t('directionLabel')}</label>
                          <select
                            value={paymentDirection}
                            onChange={(e) => setPaymentDirection(e.target.value)}
                          >
                            <option value="">{t('selectDirection')}</option>
                            <option value="in">{t('paymentIn')}</option>
                            <option value="out">{t('paymentOut')}</option>
                          </select>
                        </div>
                        <div className="field">
                          <label>{t('amountLabel')}</label>
                          <input
                            type="number"
                            min="0"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="field">
                          <label>{t('noteLabel')}</label>
                          <input
                            type="text"
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                            placeholder={t('paymentNotePlaceholder')}
                          />
                        </div>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => savePayment(freelancerDetail.freelancer.id)}
                          disabled={savingPayment}
                        >
                          {savingPayment ? t('saving') : t('save')}
                        </button>
                      </div>
                    )}

                    {!freelancerLedger && <div className="empty">{tc('loading')}</div>}
                    {freelancerLedger && freelancerLedger.entries.length === 0 && (
                      <div className="empty">{t('noEntriesYet')}</div>
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
                                {new Date(entry.created_at).toLocaleString(dateLocale, {
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
                            {t('balanceAfterEntry', { balance: Number(entry.balance_after).toFixed(2) })}
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
                              {t('reverse')}
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

      <div style={{ fontWeight: 'bold', margin: '22px 0 10px' }}>{t('defaultLevelPrices')}</div>
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
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
