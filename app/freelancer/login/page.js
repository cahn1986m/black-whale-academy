'use client';

import { useState } from 'react';
import Header from '../../Header';

export default function FreelancerLoginPage() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!phone || !pin) {
      setError('رقم الجوال والرمز مطلوبان');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/freelancer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      const rawNext = new URLSearchParams(window.location.search).get('next');
      const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/freelancer';
      window.location.href = next;
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <Header sub="دخول المدربين المستقلين" />
      {error && <div className="msg error">{error}</div>}
      <form onSubmit={submit}>
        <div className="card">
          <div className="field">
            <label>رقم الجوال</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xxxxxxxx"
              autoFocus
            />
          </div>
          <div className="field">
            <label>الرمز (PIN)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
            />
          </div>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>تذكرني على هذا الجهاز</span>
            </label>
          </div>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'جاري الدخول...' : 'دخول'}
          </button>
        </div>
      </form>
    </div>
  );
}
