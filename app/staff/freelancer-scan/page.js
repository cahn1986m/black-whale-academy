'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../Header';
import { useTranslations } from '@/lib/locale/LocaleContext';

// Same rgba-tint-plus-solid-color technique already used by
// .status-pill.present/.absent in globals.css — reused verbatim from
// app/freelancer/sessions/page.js, no new CSS custom properties.
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

export default function StaffFreelancerScanListPage() {
  const t = useTranslations('staff');
  const tc = useTranslations('common');
  const STATUS_LABELS = {
    pending: t('statusPending'),
    approved: t('statusApproved'),
    checked_in: t('statusCheckedIn'),
    closed: t('statusClosed'),
    rejected: t('statusRejected'),
  };

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/freelancer-sessions?status=approved,checked_in', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || tc('error'));
        setSessions(data.sessions);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <Header sub={t('freelancerScanSub')} />
      {error && <div className="msg error">{error}</div>}

      {loading && <div className="empty">{tc('loading')}</div>}

      {!loading && sessions.length === 0 && <div className="empty">{t('noSessionsToScan')}</div>}

      {!loading &&
        sessions.map((s) => (
          <Link href={`/staff/freelancer-scan/${s.id}`} key={s.id} className="card" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{s.freelancer_name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                  {new Date(s.session_date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })} — {s.session_time.slice(0, 5)}
                </div>
              </div>
              <span className="status-pill" style={statusPillStyle(s.status)}>
                {STATUS_LABELS[s.status] || s.status}
              </span>
            </div>
          </Link>
        ))}
    </div>
  );
}
