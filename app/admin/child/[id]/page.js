'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Header from '../../../Header';

export default function ChildBadgePage({ params }) {
  const [child, setChild] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/children/${params.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setChild(data.child);
      })
      .catch(() => setError('صار خطأ بالاتصال — تأكد من الإنترنت وحاول مرة تانية'));
  }, [params.id]);

  return (
    <div className="page">
      <a href="/admin" className="back-link">← الإدارة</a>
      <Header sub="بطاقة الطفل" />
      {error && <div className="msg error">{error}</div>}
      {!child && !error && <div className="empty">جاري التحميل...</div>}
      {child && (
        <>
          <div className="badge-card">
            {child.photo_base64 && <img src={child.photo_base64} alt={child.full_name} className="photo" />}
            <div style={{ fontWeight: 'bold', fontSize: 18 }}>{child.full_name}</div>
            <div className="qr-wrap">
              <QRCodeSVG value={child.qr_token} size={200} />
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>Black Whale Academy 🐋</div>
          </div>
          <button className="btn secondary" onClick={() => window.print()} type="button">
            🖨️ طباعة البطاقة
          </button>
        </>
      )}
    </div>
  );
}
