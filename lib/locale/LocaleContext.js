'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import common from './dictionaries/common.json';
import register from './dictionaries/register.json';
import staff from './dictionaries/staff.json';
import admin from './dictionaries/admin.json';
import freelancer from './dictionaries/freelancer.json';

const DICTIONARIES = { common, register, staff, admin, freelancer };
const COOKIE_NAME = 'bwa_locale';
const LocaleContext = createContext(null);

export function LocaleProvider({ initialLocale, children }) {
  const [locale, setLocaleState] = useState(initialLocale === 'en' ? 'en' : 'ar');

  const setLocale = useCallback((next) => {
    const value = next === 'en' ? 'en' : 'ar';
    setLocaleState(value);
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = value;
    document.documentElement.dir = value === 'en' ? 'ltr' : 'rtl';
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

// section-scoped translator: t('someKey', { name: 'X' }) with {name}-style
// interpolation. Falls back to Arabic, then to the raw key, if a string is
// missing from a dictionary (e.g. during incremental rollout).
export function useTranslations(section) {
  const { locale } = useLocale();
  const dict = DICTIONARIES[section] || {};
  const strings = dict[locale] || dict.ar || {};

  return useCallback((key, vars) => {
    let str = strings[key] ?? dict.ar?.[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, v);
      }
    }
    return str;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, section]);
}
