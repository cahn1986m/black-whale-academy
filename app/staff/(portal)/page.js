'use client';

import Link from 'next/link';
import Header from '../../Header';
import { useTranslations } from '@/lib/locale/LocaleContext';

export default function StaffHomePage() {
  const t = useTranslations('staff');

  const logout = async () => {
    await fetch('/api/staff-logout', { method: 'POST' });
    window.location.href = '/staff/login';
  };

  return (
    <div className="page">
      <Header sub={t('staffPortalSub')} />

      <Link href="/attendance" className="btn" style={{ display: 'flex', marginBottom: 12 }}>
        {t('academyAttendanceLink')}
      </Link>

      <Link href="/staff/freelancer-scan" className="btn secondary" style={{ display: 'flex', marginBottom: 12 }}>
        {t('freelancerAttendanceLink')}
      </Link>

      <Link href="/staff/instructor-attendance" className="btn secondary" style={{ display: 'flex', marginBottom: 12 }}>
        🧑‍🏫 {t('instructorAttendanceLink')}
      </Link>

      <button className="btn secondary" type="button" onClick={logout}>
        {t('logout')}
      </button>
    </div>
  );
}
