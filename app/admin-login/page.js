'use client';

import { useState } from 'react';
import Header from '../Header';
import { useTranslations } from '@/lib/locale/LocaleContext';

export default function AdminLoginPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError(t('passwordRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      const next = new URLSearchParams(window.location.search).get('next') || '/admin';
      window.location.href = next;
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <Header sub={t('loginSub')} />
      {error && <div className="msg error">{error}</div>}
      <form onSubmit={submit}>
        <div className="card">
          <div className="field">
            <label>{t('passwordLabel')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </div>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? t('loggingIn') : t('loginButton')}
          </button>
        </div>
      </form>
    </div>
  );
}
