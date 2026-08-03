'use client';

import { useLocale } from '@/lib/locale/LocaleContext';

export default function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
      className="locale-toggle"
    >
      {locale === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}
