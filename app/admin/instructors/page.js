'use client';

import { useEffect, useState } from 'react';
import Header from '../../Header';
import { useLocale, useTranslations } from '@/lib/locale/LocaleContext';

export default function AdminInstructorsPage() {
  const { locale } = useLocale();
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const dateLocale = locale === 'en' ? 'en-US' : 'ar-EG';

  const ENTRY_TYPE_LABELS = {
    payment: t('entryPayment'),
    session_pay: t('entrySessionPay'),
    reversal: t('reverse'),
    monthly_salary: t('entryMonthlySalary'),
    deduction: t('entryDeduction'),
  };

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
  const [instructorLedger, setInstructorLedger] = useState(null);

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

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentFormError, setPaymentFormError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/instructors', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
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
      setInstructorFormError(t('instructorNameRequired'));
      return;
    }

    const body = { name, contact, pay_type: payType };

    if (payType === 'per_session') {
      const defaultRatePerDay = Number(instructorForm.default_rate_per_day);
      if (!Number.isFinite(defaultRatePerDay) || defaultRatePerDay <= 0) {
        setInstructorFormError(t('rateMustBePositive'));
        return;
      }
      body.default_rate_per_day = defaultRatePerDay;
    } else {
      const monthlySalary = Number(instructorForm.monthly_salary);
      if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) {
        setInstructorFormError(t('salaryMustBePositive'));
        return;
      }
      const monthlyAbsenceDeduction = Number(instructorForm.monthly_absence_deduction);
      if (!Number.isFinite(monthlyAbsenceDeduction) || monthlyAbsenceDeduction <= 0) {
        setInstructorFormError(t('absenceDeductionMustBePositive'));
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
      if (!res.ok) throw new Error(data.error || tc('error'));
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

  const loadLedger = async (instructorId) => {
    try {
      const res = await fetch(`/api/admin/instructors/${instructorId}/ledger`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setInstructorLedger({ entries: data.entries, currentBalance: data.currentBalance });
      setInstructors((prev) =>
        prev.map((i) => (i.id === instructorId ? { ...i, current_balance: data.currentBalance } : i))
      );
      setInstructorDetail((prev) =>
        prev && prev.instructor.id === instructorId
          ? { ...prev, instructor: { ...prev.instructor, current_balance: data.currentBalance } }
          : prev
      );
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    }
  };

  const loadInstructorDetail = async (instructorId) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/instructors/${instructorId}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setInstructorDetail({ instructor: data.instructor, linkedActivities: data.linkedActivities });
      setEditForm({
        name: data.instructor.name,
        contact: data.instructor.contact || '',
        pay_type: data.instructor.pay_type,
        default_rate_per_day: data.instructor.default_rate_per_day ?? '',
        monthly_salary: data.instructor.monthly_salary ?? '',
        monthly_absence_deduction: data.instructor.monthly_absence_deduction ?? '',
      });
      loadLedger(instructorId);
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
      setInstructorLedger(null);
      return;
    }
    setExpandedInstructorId(instructorId);
    setInstructorDetail(null);
    setInstructorLedger(null);
    setShowPaymentForm(false);
    setPaymentDirection('');
    setPaymentAmount('');
    setPaymentNote('');
    setPaymentFormError('');
    loadInstructorDetail(instructorId);
  };

  const toggleActive = async (instructor) => {
    const nextActive = !instructor.active;
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
      const res = await fetch(`/api/admin/instructors/${instructor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive, deactivation_reason: deactivationReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setInstructors((prev) => prev.map((i) => (i.id === instructor.id ? { ...i, active: nextActive, deactivation_reason: deactivationReason } : i)));
      setInstructorDetail((prev) =>
        prev && prev.instructor.id === instructor.id
          ? { ...prev, instructor: { ...prev.instructor, active: nextActive, deactivation_reason: deactivationReason } }
          : prev
      );
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    }
  };

  const saveEdit = async (instructorId) => {
    const name = editForm.name.trim();
    const contact = editForm.contact.trim();
    const payType = editForm.pay_type;

    if (!name) {
      alert(t('instructorNameRequired'));
      return;
    }

    const body = { name, contact, pay_type: payType };

    if (payType === 'per_session') {
      const defaultRatePerDay = Number(editForm.default_rate_per_day);
      if (!Number.isFinite(defaultRatePerDay) || defaultRatePerDay <= 0) {
        alert(t('rateMustBePositive'));
        return;
      }
      body.default_rate_per_day = defaultRatePerDay;
    } else {
      const monthlySalary = Number(editForm.monthly_salary);
      if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) {
        alert(t('salaryMustBePositive'));
        return;
      }
      const monthlyAbsenceDeduction = Number(editForm.monthly_absence_deduction);
      if (!Number.isFinite(monthlyAbsenceDeduction) || monthlyAbsenceDeduction <= 0) {
        alert(t('absenceDeductionMustBePositive'));
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
      if (!res.ok) throw new Error(data.error || tc('error'));
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
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const issueSalary = async (instructorId) => {
    setIssuingSalary(true);
    try {
      const res = await fetch(`/api/admin/instructors/${instructorId}/issue-salary`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      alert(t('salaryIssuedSuccess'));
      loadInstructorDetail(instructorId);
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    } finally {
      setIssuingSalary(false);
    }
  };

  const savePayment = async (instructorId) => {
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
      const res = await fetch(`/api/admin/instructors/${instructorId}/ledger`, {
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
      loadLedger(instructorId);
    } catch (err) {
      setPaymentFormError(err.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const reverseEntry = async (instructorId, entry) => {
    const reason = window.prompt(t('reverseReasonPrompt'));
    if (reason === null) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) return;
    try {
      const res = await fetch(`/api/admin/instructors/${instructorId}/ledger`, {
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
      loadLedger(instructorId);
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    }
  };

  return (
    <div className="page">
      <a href="/admin" className="back-link">← {t('backToManagement')}</a>
      <Header sub={t('manageInstructorsSub')} />
      {error && <div className="msg error">{error}</div>}

      <div className="card">
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>{t('addNewInstructor')}</div>
        {instructorFormError && <div className="msg error">{instructorFormError}</div>}
        <form onSubmit={addInstructor}>
          <div className="field">
            <label>{t('nameLabel')}</label>
            <input
              type="text"
              value={instructorForm.name}
              onChange={(e) => setInstructorForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('nameLabel')}
            />
          </div>
          <div className="field">
            <label>{t('contactOptionalLabel')}</label>
            <input
              type="text"
              value={instructorForm.contact}
              onChange={(e) => setInstructorForm((f) => ({ ...f, contact: e.target.value }))}
              placeholder={t('contactPlaceholder')}
            />
          </div>
          <div className="field">
            <label>{t('payTypeLabel')}</label>
            <select
              value={instructorForm.pay_type}
              onChange={(e) => setInstructorForm((f) => ({ ...f, pay_type: e.target.value }))}
            >
              <option value="per_session">{t('payTypePerSession')}</option>
              <option value="monthly">{t('payTypeMonthly')}</option>
            </select>
          </div>
          {instructorForm.pay_type === 'per_session' ? (
            <div className="field">
              <label>{t('ratePerDayLabel')}</label>
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
                <label>{t('monthlySalaryLabel')}</label>
                <input
                  type="number"
                  min="0"
                  value={instructorForm.monthly_salary}
                  onChange={(e) => setInstructorForm((f) => ({ ...f, monthly_salary: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="field">
                <label>{t('monthlyAbsenceDeductionLabel')}</label>
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
            {savingInstructor ? t('adding') : t('addInstructor')}
          </button>
        </form>
      </div>

      <div style={{ fontWeight: 'bold', margin: '18px 0 10px' }}>{t('instructorsCount', { count: instructors.length })}</div>
      {loading && <div className="empty">{tc('loading')}</div>}
      {!loading && instructors.length === 0 && <div className="empty">{t('noInstructorsYet')}</div>}

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
                {i.active ? t('active') : t('disabled')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', marginInlineEnd: 8 }}>
                {i.pay_type === 'monthly' ? t('monthlyShort') : t('perSessionShort')}
              </span>
              <span style={{ fontWeight: 'bold', color: Number(i.current_balance) < 0 ? 'var(--absent)' : 'var(--text)' }}>
                {Number(i.current_balance).toFixed(2)}
              </span>
            </div>

            {expandedInstructorId === i.id && (
              <div className="card" style={{ marginTop: -4 }}>
                {loadingDetail && <div className="empty">{tc('loading')}</div>}

                {!loadingDetail && instructorDetail && instructorDetail.instructor.id === i.id && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{t('accountStatus')}</span>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => toggleActive(instructorDetail.instructor)}
                        style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                      >
                        {instructorDetail.instructor.active ? t('disableAccount') : t('enableAccount')}
                      </button>
                    </div>
                    {!instructorDetail.instructor.active && instructorDetail.instructor.deactivation_reason && (
                      <div style={{ fontSize: 12, color: '#b45309', marginBottom: 12 }}>
                        {t('deactivationReasonLine', { reason: instructorDetail.instructor.deactivation_reason })}
                      </div>
                    )}

                    <div className="field">
                      <label>{t('nameLabel')}</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>{t('contactLabel')}</label>
                      <input
                        type="text"
                        value={editForm.contact}
                        onChange={(e) => setEditForm((f) => ({ ...f, contact: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>{t('payTypeLabel')}</label>
                      <select
                        value={editForm.pay_type}
                        onChange={(e) => setEditForm((f) => ({ ...f, pay_type: e.target.value }))}
                      >
                        <option value="per_session">{t('payTypePerSession')}</option>
                        <option value="monthly">{t('payTypeMonthly')}</option>
                      </select>
                    </div>
                    {editForm.pay_type === 'per_session' ? (
                      <div className="field">
                        <label>{t('ratePerDayLabel')}</label>
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
                          <label>{t('monthlySalaryLabel')}</label>
                          <input
                            type="number"
                            min="0"
                            value={editForm.monthly_salary}
                            onChange={(e) => setEditForm((f) => ({ ...f, monthly_salary: e.target.value }))}
                          />
                        </div>
                        <div className="field">
                          <label>{t('monthlyAbsenceDeductionLabel')}</label>
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
                      {savingEdit ? t('saving') : t('save')}
                    </button>

                    {instructorDetail.instructor.pay_type === 'monthly' && (
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => issueSalary(instructorDetail.instructor.id)}
                        disabled={issuingSalary}
                        style={{ marginTop: 8 }}
                      >
                        {issuingSalary ? t('issuing') : t('issueSalaryThisMonth')}
                      </button>
                    )}

                    <div style={{ fontWeight: 'bold', margin: '18px 0 8px' }}>{t('linkedActivities')}</div>
                    {instructorDetail.linkedActivities.length === 0 ? (
                      <div className="empty">{t('noLinkedActivity')}</div>
                    ) : (
                      instructorDetail.linkedActivities.map((a) => (
                        <div key={a.id} style={{ fontSize: 13, padding: '6px 0' }}>
                          {a.name}
                        </div>
                      ))
                    )}

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
                          onClick={() => savePayment(instructorDetail.instructor.id)}
                          disabled={savingPayment}
                        >
                          {savingPayment ? t('saving') : t('save')}
                        </button>
                      </div>
                    )}

                    {!instructorLedger && <div className="empty">{tc('loading')}</div>}
                    {instructorLedger && instructorLedger.entries.length === 0 && (
                      <div className="empty">{t('noEntriesYet')}</div>
                    )}
                    {instructorLedger && instructorLedger.entries.length > 0 && (() => {
                      const reversedIds = new Set(
                        instructorLedger.entries
                          .filter((e) => e.reversed_entry_id != null)
                          .map((e) => e.reversed_entry_id)
                      );
                      return instructorLedger.entries.map((entry) => (
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
                              onClick={() => reverseEntry(instructorDetail.instructor.id, entry)}
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
    </div>
  );
}
