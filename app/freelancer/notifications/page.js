'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../Header';

function formatSessionDateTime(dateStr, timeStr) {
  const date = new Date(dateStr).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = (timeStr || '').slice(0, 5);
  return { date, time };
}

function eventMessage(n) {
  const { date, time } = formatSessionDateTime(n.session_date, n.session_time);
  switch (n.event_type) {
    case 'approved':
      return `تمت الموافقة على جلستك بتاريخ ${date} الساعة ${time}`;
    case 'rejected':
      return `تم رفض جلستك بتاريخ ${date} الساعة ${time}`;
    case 'closed':
      return `تم إغلاق جلستك بتاريخ ${date} الساعة ${time}`;
    default:
      return n.event_type;
  }
}

export default function FreelancerNotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/freelancer/notifications', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'صار خطأ');
        setNotifications(data.notifications);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    try {
      const res = await fetch(`/api/freelancer/notifications/${id}/read`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <Header sub="الإشعارات" />
      {error && <div className="msg error">{error}</div>}

      {loading && <div className="empty">جاري التحميل...</div>}

      {!loading && notifications.length === 0 && <div className="empty">ما في إشعارات بعد</div>}

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
                  جديد
                </span>
              )}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
              {new Date(n.created_at).toLocaleString('ar-EG', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>

            <div style={{ marginTop: 8 }}>
              <Link href={`/freelancer/sessions/${n.session_id}`} style={{ fontSize: 13, color: 'var(--accent-dark)' }}>
                عرض الجلسة ←
              </Link>
            </div>
          </div>
        ))}
    </div>
  );
}
