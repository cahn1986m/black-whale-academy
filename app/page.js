'use client';

import Link from 'next/link';
import CopyLink from './CopyLink';
import Header from './Header';
import { useTranslations } from '@/lib/locale/LocaleContext';

export default function HomePage() {
  const t = useTranslations('common');

  return (
    <div className="page">
      <Header sub={t('homeSub')} />

      <div className="nav-grid">
        <Link href="/staff" className="nav-tile">
          <span className="emoji">✅</span>
          <span className="label">{t('navDailyAttendance')}</span>
        </Link>
        <Link href="/admin" className="nav-tile">
          <span className="emoji">⚙️</span>
          <span className="label">{t('navManagement')}</span>
        </Link>
        <Link href="/history" className="nav-tile">
          <span className="emoji">📅</span>
          <span className="label">{t('navHistory')}</span>
        </Link>
        <Link href="/register" className="nav-tile">
          <span className="emoji">📝</span>
          <span className="label">{t('navRegisterTrainee')}</span>
        </Link>
        <Link href="/register/special" className="nav-tile">
          <span className="emoji">🧩</span>
          <span className="label">{t('navRegisterSpecialNeeds')}</span>
        </Link>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <label style={{ fontSize: 13, color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>
          {t('parentLinkLabel')}
        </label>
        <CopyLink path="/register" />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <label style={{ fontSize: 13, color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>
          {t('staffLinkLabel')}
        </label>
        <CopyLink path="/staff" />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <label style={{ fontSize: 13, color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>
          {t('freelancerLinkLabel')}
        </label>
        <CopyLink path="/freelancer/login" />
      </div>
    </div>
  );
}
