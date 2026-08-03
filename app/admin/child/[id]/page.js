'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Header from '../../../Header';
import { useTranslations } from '@/lib/locale/LocaleContext';

export default function ChildBadgePage({ params }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const [child, setChild] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const badgeRef = useRef(null);

  useEffect(() => {
    fetch(`/api/children/${params.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setChild(data.child);
      })
      .catch(() => setError(t('connectionError')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const downloadBadge = async () => {
    if (!badgeRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(badgeRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `qr-${child.full_name}.png`;
      link.click();
    } catch {
      alert(t('errBadgeDownload'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="page">
      <a href="/admin" className="back-link">← {t('backToManagement')}</a>
      <Header sub={t('badgeSub')} />
      {error && <div className="msg error">{error}</div>}
      {!child && !error && <div className="empty">{tc('loading')}</div>}
      {child && (
        <>
          <div className="badge-card" ref={badgeRef}>
            {child.photo_base64 && <img src={child.photo_base64} alt={child.full_name} className="photo" />}
            <div style={{ fontWeight: 'bold', fontSize: 18 }}>{child.full_name}</div>
            <div className="qr-wrap">
              <QRCodeSVG value={child.qr_token} size={200} />
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>Black Whale Academy 🐋</div>
          </div>
          <button className="btn secondary" onClick={downloadBadge} disabled={downloading} type="button">
            {downloading ? t('preparingImage') : t('downloadImage')}
          </button>
          <button className="btn secondary" onClick={() => window.print()} type="button" style={{ marginTop: 8 }}>
            {t('printBadge')}
          </button>
        </>
      )}
    </div>
  );
}
