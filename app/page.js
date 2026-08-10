'use client';

import { useState } from 'react';
import Link from 'next/link';
import CopyLink from './CopyLink';
import Header from './Header';
import { useTranslations } from '@/lib/locale/LocaleContext';

// Hardcoded to the real production domain (not window.location.origin)
// deliberately — this button must always copy the live, shareable URL
// regardless of which host the page happens to be viewed from (localhost
// during dev, a Vercel preview deployment, etc.).
const SPECIAL_NEEDS_REGISTER_URL = 'https://black-whale-academy-4yj1.vercel.app/register/special';

export default function HomePage() {
  const t = useTranslations('common');
  const [copiedSpecial, setCopiedSpecial] = useState(false);

  const copySpecialLink = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(SPECIAL_NEEDS_REGISTER_URL);
      setCopiedSpecial(true);
      setTimeout(() => setCopiedSpecial(false), 2000);
    } catch {
      // clipboard API unavailable/denied — no fallback UI needed here,
      // the tile itself still works as a normal link either way.
    }
  };

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
        <div style={{ position: 'relative' }}>
          <Link href="/register/special" className="nav-tile" style={{ display: 'block' }}>
            <span className="emoji">🧩</span>
            <span className="label">{t('navRegisterSpecialNeeds')}</span>
          </Link>
          <button
            type="button"
            onClick={copySpecialLink}
            style={{
              position: 'absolute',
              top: 6,
              insetInlineEnd: 6,
              fontSize: 11,
              padding: '4px 7px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            {copiedSpecial ? t('copySpecialLinkCopied') : t('copySpecialLinkButton')}
          </button>
        </div>
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
