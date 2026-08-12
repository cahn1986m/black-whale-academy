'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from './Header';
import { useTranslations } from '@/lib/locale/LocaleContext';

// Hardcoded to the real production domain (not window.location.origin)
// deliberately — these buttons must always copy the live, shareable URL
// regardless of which host the page happens to be viewed from (localhost
// during dev, a Vercel preview deployment, etc.).
const PROD_BASE = 'https://black-whale-academy-4yj1.vercel.app';
const REGISTER_URL = `${PROD_BASE}/register`;
const SPECIAL_NEEDS_URL = `${PROD_BASE}/register/special`;
const FREELANCER_LOGIN_URL = `${PROD_BASE}/freelancer/login`;

function GatewayCard({ href, emoji, label, url, t }) {
  const [copied, setCopied] = useState(false);

  const copy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable/denied — the card itself still works as
      // a normal link either way, no fallback UI needed here.
    }
  };

  return (
    <Link href={href} className="home-gateway-card">
      <span className="emoji">{emoji}</span>
      <span className="label">{label}</span>
      <button type="button" className="home-copy-btn" onClick={copy}>
        {copied ? t('homeCopyLinkCopied') : t('homeCopyLinkButton')}
      </button>
    </Link>
  );
}

export default function HomePage() {
  const t = useTranslations('common');
  // Sums two counts /admin already tracks and queries itself (reused
  // as-is, not reinvented): pending_approval enrollments
  // (GET /api/admin/pending-registrations) and pending freelancer
  // session requests (GET /api/admin/freelancer-sessions?status=pending).
  // Both routes are admin-only; a visitor without an admin session simply
  // gets 401 here, which is treated the same as "nothing pending" — this
  // page is public, so it must never leak the actual count to someone
  // who isn't already authenticated as admin.
  const [pendingAdminCount, setPendingAdminCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/admin/pending-registrations', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { registrations: [] })),
      fetch('/api/admin/freelancer-sessions?status=pending', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { sessions: [] })),
    ])
      .then(([regData, sessionData]) => {
        if (cancelled) return;
        setPendingAdminCount((regData.registrations?.length || 0) + (sessionData.sessions?.length || 0));
      })
      .catch(() => {
        if (!cancelled) setPendingAdminCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="home-container">
      <div className="home-bg-bubbles" aria-hidden="true">
        <span /><span /><span /><span /><span /><span /><span />
      </div>

      <div className="home-bg-whale" aria-hidden="true">
        {/* Silhouette echoes the diving whale in public/logo.png (rounded
            snout, sharp dorsal-fin peak, forked tail, ribbed belly) instead
            of an invented shape, so it reads as "whale" rather than a
            generic blob even at this small, low-opacity scale. */}
        <svg viewBox="0 0 140 70" xmlns="http://www.w3.org/2000/svg">
          <path
            className="whale-body"
            d="M128,32 C124,24 120,19 118,18 Q108,15 95,14 L75,4 Q68,9 60,15
               C50,18 40,20 35,22 L8,8 L20,30 L4,46 L32,36
               C40,40 47,44 55,46 Q68,48 80,48 Q95,47 105,44
               C112,42 118,40 122,38 Z"
          />
          <circle className="whale-eye" cx="112" cy="26" r="2.3" />
          <path
            className="whale-belly"
            d="M100,40 Q105,44 112,42 M96,43 Q102,47 110,45 M92,46 Q99,50 107,48"
          />
          <path className="whale-spout" d="M120,10 Q122,2 126,8 M124,7 Q126,-1 130,5" />
        </svg>
      </div>

      <Header sub={t('homeSub')} />

      <Link href="/staff" className="home-hero">
        <span className="emoji">✅</span>
        <span className="label">{t('navDailyAttendance')}</span>
      </Link>

      <div className="home-nav-grid">
        <Link href="/admin" className="nav-tile" style={{ position: 'relative' }}>
          <span className="emoji">⚙️</span>
          <span className="label">{t('navManagement')}</span>
          {pendingAdminCount > 0 && <span className="home-badge">{pendingAdminCount}</span>}
        </Link>
        <Link href="/history" className="nav-tile">
          <span className="emoji">📅</span>
          <span className="label">{t('navHistory')}</span>
        </Link>
      </div>

      <div className="home-gateway-grid">
        <GatewayCard href="/register" emoji="📝" label={t('navRegisterTrainee')} url={REGISTER_URL} t={t} />
        <GatewayCard href="/register/special" emoji="🧩" label={t('navRegisterSpecialNeeds')} url={SPECIAL_NEEDS_URL} t={t} />
        <GatewayCard href="/freelancer/login" emoji="🏊" label={t('navFreelancerLogin')} url={FREELANCER_LOGIN_URL} t={t} />
      </div>
    </div>
  );
}
