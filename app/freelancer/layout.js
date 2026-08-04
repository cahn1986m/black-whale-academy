'use client';

import Link from 'next/link';
import { useTranslations } from '@/lib/locale/LocaleContext';

export default function FreelancerLayout({ children }) {
  const t = useTranslations('freelancer');
  const tc = useTranslations('common');

  const logout = async () => {
    await fetch('/api/freelancer/logout', { method: 'POST' });
    window.location.href = '/freelancer/login';
  };

  return (
    <div>
      <div className="tabs" style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 0' }}>
        <Link href="/freelancer" className="tab">{tc('backHome')}</Link>
        <Link href="/freelancer/book" className="tab">{t('navBookSession')}</Link>
        <Link href="/freelancer/sessions" className="tab">{t('mySessionsSub')}</Link>
        <Link href="/freelancer/ledger" className="tab">{t('ledgerSub')}</Link>
        <Link href="/freelancer/notifications" className="tab">{t('notificationsSub')}</Link>
        <button type="button" className="tab" onClick={logout}>{t('logout')}</button>
      </div>
      {children}
    </div>
  );
}
