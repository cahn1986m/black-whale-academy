'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../Header';

const ENTRY_TYPE_LABELS = {
  payment: 'دفعة',
  session_charge: 'تحصيل جلسة',
  no_show_fee: 'غرامة غياب',
  reversal: 'عكس حركة',
};

export default function FreelancerLedgerPage() {
  const [entries, setEntries] = useState([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/freelancer/ledger', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'صار خطأ');
        setEntries(data.entries);
        setCurrentBalance(data.currentBalance);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <Header sub="كشف الحساب" />
      {error && <div className="msg error">{error}</div>}

      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }}>الرصيد الحالي</div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 'bold',
            color: Number(currentBalance) < 0 ? 'var(--absent)' : 'var(--text)',
          }}
        >
          {Number(currentBalance).toFixed(2)}
        </div>
      </div>

      {loading && <div className="empty">جاري التحميل...</div>}

      {!loading && entries.length === 0 && <div className="empty">ما في حركات بعد</div>}

      {!loading &&
        entries.map((e) => (
          <div className="card" key={e.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {new Date(e.created_at).toLocaleString('ar-EG', {
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
                  color: Number(e.amount) < 0 ? 'var(--absent)' : 'var(--present)',
                }}
              >
                {Number(e.amount).toFixed(2)}
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
              الرصيد بعد الحركة: {Number(e.balance_after).toFixed(2)}
            </div>

            {e.note && (
              <div style={{ fontSize: 13, marginTop: 8 }}>{e.note}</div>
            )}

            {e.related_session_id && (
              <div style={{ marginTop: 8 }}>
                <Link href={`/freelancer/sessions/${e.related_session_id}`} style={{ fontSize: 13, color: 'var(--accent-dark)' }}>
                  عرض الجلسة المرتبطة ←
                </Link>
              </div>
            )}

            {e.reversed_entry_id && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
                عكس للحركة #{e.reversed_entry_id}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
