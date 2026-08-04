'use client';

import LocaleToggle from './LocaleToggle';
import { useTranslations } from '@/lib/locale/LocaleContext';

export default function Header({ title, sub }) {
  const tc = useTranslations('common');

  return (
    <div className="header">
      <img src="/logo.png" alt="Black Whale Academy" className="brand-logo" />
      <div style={{ flex: 1 }}>
        <h1>{title || tc('brandName')}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      <LocaleToggle />
    </div>
  );
}
