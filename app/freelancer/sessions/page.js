'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../Header';

const STATUS_LABELS = {
  pending: 'بانتظار الموافقة',
  approved: 'موافق عليها',
  checked_in: 'جارية',
  closed: 'مغلقة',
  rejected: 'مرفوضة',
};

// Reuses the .status-pill shape/pattern already defined in globals.css
// (padding, border-radius, font-size, no border) — only the color/tint
// values are set here, and only from colors that already exist as CSS
// custom properties (--text, --text-dim, --present, --absent), matching
// the same rgba-tint-plus-solid-color technique .status-pill.present
// and .status-pill.absent already use.
function statusPillStyle(status) {
  switch (status) {
    case 'pending':
      return { color: 'var(--text-dim)', background: 'rgba(92, 130, 153, 0.14)' };
    case 'approved':
      return { color: 'var(--text)', background: 'rgba(15, 58, 82, 0.10)' };
    case 'checked_in':
      return { color: 'var(--present)', background: 'rgba(34, 181, 115, 0.10)' };
    case 'closed':
      return { color: 'var(--present)', background: 'rgba(34, 181, 115, 0.16)' };
    case 'rejected':
      return { color: 'var(--absent)', background: 'rgba(239, 68, 68, 0.14)' };
    default:
      return { color: 'var(--text-dim)', background: 'rgba(92, 130, 153, 0.14)' };
  }
}

const FILTERS = [
  { value: '', label: 'الكل' },
  { value: 'pending', label: 'بانتظار الموافقة' },
  { value: 'approved', label: 'موافق عليها' },
  { value: 'checked_in', label: 'جارية' },
  { value: 'closed', label: 'مغلقة' },
  { value: 'rejected', label: 'مرفوضة' },
];

export default function FreelancerSessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const url = statusFilter ? `/api/freelancer/sessions?status=${statusFilter}` : '/api/freelancer/sessions';
    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'صار خطأ');
        setSessions(data.sessions);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div className="page">
      <Header sub="جلساتي" />
      {error && <div className="msg error">{error}</div>}

      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`tab ${statusFilter === f.value ? 'active' : ''}`}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div className="empty">جاري التحميل...</div>}

      {!loading && sessions.length === 0 && <div className="empty">ما في جلسات بعد</div>}

      {!loading &&
        sessions.map((s) => (
          <Link href={`/freelancer/sessions/${s.id}`} key={s.id} className="card" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>
                  {new Date(s.session_date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{s.session_time.slice(0, 5)}</div>
              </div>
              <span className="status-pill" style={statusPillStyle(s.status)}>
                {STATUS_LABELS[s.status] || s.status}
              </span>
            </div>
            {s.status === 'rejected' && s.rejection_reason && (
              <div style={{ fontSize: 13, color: 'var(--absent)', marginTop: 8 }}>
                سبب الرفض: {s.rejection_reason}
              </div>
            )}
          </Link>
        ))}
    </div>
  );
}
