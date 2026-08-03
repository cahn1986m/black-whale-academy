'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../Header';
import { useLocale, useTranslations } from '@/lib/locale/LocaleContext';

export default function FreelancerNotificationsPage() {
  const { locale } = useLocale();
  const t = useTranslations('freelancer');
  const tc = useTranslations('common');
  const dateLocale = locale === 'en' ? 'en-US' : 'ar-EG';

  const formatSessionDateTime = (dateStr, timeStr) => {
    const date = new Date(dateStr).toLocaleDateString(dateLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const time = (timeStr || '').slice(0, 5);
    return { date, time };
  };

  const eventMessage = (n) => {
    const { date, time } = formatSessionDateTime(n.session_date, n.session_time);
    switch (n.event_type) {
      case 'approved':
        return t('eventApproved', { date, time });
      case 'rejected':
        return t('eventRejected', { date, time });
      case 'closed':
        return t('eventClosed', { date, time });
      default:
        return n.event_type;
    }
  };

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/freelancer/notifications', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || tc('error'));
        setNotifications(data.notifications);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    try {
      const res = await fetch(`/api/freelancer/notifications/${id}/read`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <Header sub={t('notificationsSub')} />
      {error && <div className="msg error">{error}</div>}

      {loading && <div className="empty">{tc('loading')}</div>}

      {!loading && notifications.length === 0 && <div className="empty">{t('noNotificationsYet')}</div>}

      {!loading &&
        notifications.map((n) => (
          <div
            key={n.id}
            className="card"
            onClick={() => {
              if (!n.is_read) markRead(n.id);
            }}
            style={{
              cursor: n.is_read ? 'default' : 'pointer',
              background: n.is_read ? 'var(--surface)' : 'var(--surface-2)',
              borderColor: n.is_read ? 'var(--border)' : 'var(--accent)',
              borderWidth: n.is_read ? 1 : 2,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ fontWeight: n.is_read ? 'normal' : 'bold', fontSize: 14 }}>{eventMessage(n)}</div>
              {!n.is_read && (
                <span
                  className="status-pill"
                  style={{ color: 'var(--text)', background: 'rgba(15, 58, 82, 0.10)', flexShrink: 0 }}
                >
                  {t('newBadge')}
                </span>
              )}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
              {new Date(n.created_at).toLocaleString(dateLocale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>

            <div style={{ marginTop: 8 }}>
              <Link href={`/freelancer/sessions/${n.session_id}`} style={{ fontSize: 13, color: 'var(--accent-dark)' }}>
                {t('viewSession')}
              </Link>
            </div>
          </div>
        ))}
    </div>
  );
}
