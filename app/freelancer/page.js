'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../Header';

export default function FreelancerHomePage() {
  const [freelancer, setFreelancer] = useState(null);
  const [balance, setBalance] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJson = (url) =>
      fetch(url, { cache: 'no-store' }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'صار خطأ');
        return data;
      });

    Promise.all([
      fetchJson('/api/freelancer/me'),
      fetchJson('/api/freelancer/ledger'),
      fetchJson('/api/freelancer/sessions?status=pending'),
    ])
      .then(([meData, ledgerData, sessionsData]) => {
        setFreelancer(meData.freelancer);
        setBalance(ledgerData.currentBalance);
        setPendingCount(sessionsData.sessions.length);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const balanceNumber = balance !== null ? Number(balance) : null;
  const isNegative = balanceNumber !== null && balanceNumber < 0;

  return (
    <div className="page">
      <Header sub="لوحة المدرب المستقل" />
      {error && <div className="msg error">{error}</div>}

      {loading && !error && <div className="empty">جاري التحميل...</div>}

      {!loading && !error && (
        <>
          <div className="card">
            <p style={{ margin: 0 }}>مرحباً {freelancer?.name}</p>
          </div>

          <div className="card" style={isNegative ? { borderColor: 'var(--absent)' } : undefined}>
            <label style={{ fontSize: 13, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
              الرصيد الحالي
            </label>
            <p
              style={{
                fontSize: 28,
                fontWeight: 'bold',
                margin: 0,
                color: isNegative ? 'var(--absent)' : 'var(--present)',
              }}
            >
              {balanceNumber !== null ? balanceNumber.toFixed(2) : '—'} درهم
            </p>
          </div>

          {pendingCount > 0 && (
            <Link href="/freelancer/sessions" className="summary-bar">
              <span>جلسات بانتظار الموافقة</span>
              <span className="count">{pendingCount}</span>
            </Link>
          )}

          <Link href="/freelancer/book" className="btn" style={{ display: 'flex', marginBottom: 14 }}>
            + حجز جلسة جديدة
          </Link>
        </>
      )}
    </div>
  );
}
