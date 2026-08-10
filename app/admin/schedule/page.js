'use client';

import { useEffect, useState } from 'react';
import Header from '../../Header';
import { useTranslations } from '@/lib/locale/LocaleContext';
import { DAYS_OF_WEEK, ALLOWED_START_HOURS } from '@/lib/businessHours';

const DAY_LABEL_KEYS = {
  sunday: 'daySunday', monday: 'dayMonday', tuesday: 'dayTuesday', wednesday: 'dayWednesday',
  thursday: 'dayThursday', friday: 'dayFriday', saturday: 'daySaturday',
};

function allHours() {
  const set = new Set();
  Object.values(ALLOWED_START_HOURS).forEach((hours) => hours.forEach((h) => set.add(h)));
  return Array.from(set).sort((a, b) => a - b);
}

export default function AdminSchedulePage() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSlotId, setExpandedSlotId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/admin/schedule', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || tc('error'));
        setSlots(data.slots || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hours = allHours();

  return (
    <div className="page">
      <a href="/admin" className="back-link">← {t('backToManagement')}</a>
      <Header sub={t('scheduleTitle')} />
      {error && <div className="msg error">{error}</div>}
      {loading && <div className="empty">{tc('loading')}</div>}

      {!loading && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ padding: 8, borderBottom: '1px solid var(--border)', textAlign: 'start', fontSize: 12 }}></th>
                {DAYS_OF_WEEK.map((day) => (
                  <th key={day} style={{ padding: 8, borderBottom: '1px solid var(--border)', fontSize: 12, textAlign: 'center' }}>
                    {t(DAY_LABEL_KEYS[day])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => {
                const hh = String(hour).padStart(2, '0');
                return (
                  <tr key={hour}>
                    <td style={{ padding: 8, borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                      {hh}:00
                    </td>
                    {DAYS_OF_WEEK.map((day) => {
                      const cellSlots = slots.filter((s) => s.day_of_week === day && s.start_time.slice(0, 2) === hh);
                      const isOpen = ALLOWED_START_HOURS[day]?.includes(hour);
                      return (
                        <td
                          key={day}
                          style={{
                            padding: 6,
                            borderBottom: '1px solid var(--border)',
                            verticalAlign: 'top',
                            background: isOpen ? 'transparent' : 'var(--surface-2)',
                            minWidth: 100,
                          }}
                        >
                          {cellSlots.map((s) => (
                            <div key={s.id} style={{ marginBottom: 4 }}>
                              <button
                                type="button"
                                onClick={() => setExpandedSlotId(expandedSlotId === s.id ? null : s.id)}
                                className="status-pill present"
                                style={{ width: '100%', textAlign: 'start', fontSize: 11, cursor: 'pointer' }}
                              >
                                {s.emoji ? `${s.emoji} ` : ''}{s.activity_name} ({s.children.length})
                              </button>
                              {expandedSlotId === s.id && (
                                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, paddingInlineStart: 4 }}>
                                  {s.children.length === 0 ? (
                                    <div>{t('noChildrenAssigned')}</div>
                                  ) : (
                                    s.children.map((c) => <div key={c.id}>{c.full_name}</div>)
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
