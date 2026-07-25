'use client';

import { useEffect, useState } from 'react';
import Header from '../../Header';

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
};

export default function FreelancerBookSessionPage() {
  const [pricing, setPricing] = useState([]);
  const [pricingError, setPricingError] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [rows, setRows] = useState([{ level: '', count: '' }]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/freelancer/pricing', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'صار خطأ');
        setPricing(data.pricing);
      })
      .catch((err) => setPricingError(err.message));
  }, []);

  const updateRow = (index, field, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { level: '', count: '' }]);
  };

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!sessionDate || !sessionTime) {
      setError('التاريخ والوقت مطلوبان');
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const count = Number(row.count);
      if (!row.level) {
        setError(`العنصر رقم ${i + 1}: المستوى مطلوب`);
        return;
      }
      if (!Number.isInteger(count) || count <= 0) {
        setError(`العنصر رقم ${i + 1}: عدد الأطفال يجب أن يكون رقماً صحيحاً موجباً`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/freelancer/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionDate,
          sessionTime,
          levelCounts: rows.map((row) => ({ level: row.level, count: Number(row.count) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setSuccess('تم إرسال طلب الحجز بنجاح');
      window.location.href = `/freelancer/sessions/${data.sessionId}`;
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <Header sub="حجز جلسة جديدة" />
      {error && <div className="msg error">{error}</div>}
      {success && <div className="msg success">{success}</div>}
      {pricingError && <div className="msg error">{pricingError}</div>}

      <form onSubmit={submit}>
        <div className="card">
          <div className="field">
            <label>التاريخ</label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>الوقت</label>
            <input
              type="time"
              value={sessionTime}
              onChange={(e) => setSessionTime(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="card">
          <label style={{ fontSize: 13, color: 'var(--text-dim)', display: 'block', marginBottom: 10 }}>
            المستويات المطلوبة
          </label>

          {rows.map((row, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <div className="field" style={{ flex: 2, marginBottom: 0 }}>
                <select value={row.level} onChange={(e) => updateRow(index, 'level', e.target.value)}>
                  <option value="">اختر المستوى</option>
                  {pricing.map((p) => (
                    <option key={p.level} value={p.level}>
                      {p.level} — {p.price} درهم
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="العدد"
                  value={row.count}
                  onChange={(e) => updateRow(index, 'count', e.target.value)}
                  style={inputStyle}
                />
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => removeRow(index)}
                  style={{ width: 'auto', padding: '10px 12px' }}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <button type="button" className="btn secondary" onClick={addRow}>
            + إضافة مستوى
          </button>
        </div>

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'جاري الإرسال...' : 'إرسال طلب الحجز'}
        </button>
      </form>
    </div>
  );
}
