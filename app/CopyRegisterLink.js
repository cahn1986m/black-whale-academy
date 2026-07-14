'use client';

import { useEffect, useState } from 'react';

export default function CopyRegisterLink() {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/register`);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback: select handled by user manually
    }
  };

  return (
    <div>
      <div
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 13,
          color: 'var(--text-dim)',
          marginBottom: 10,
          wordBreak: 'break-all',
          direction: 'ltr',
          textAlign: 'left',
        }}
      >
        {url || '...'}
      </div>
      <button className="btn secondary" onClick={copy} type="button">
        {copied ? 'تم النسخ ✓' : 'نسخ الرابط'}
      </button>
    </div>
  );
}
