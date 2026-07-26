'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import Header from '../../../Header';

const STATUS_LABELS = {
  pending: 'بانتظار الموافقة',
  approved: 'موافق عليها',
  checked_in: 'جارية',
  closed: 'مغلقة',
  rejected: 'مرفوضة',
};

// Same technique already used by .status-pill.present/.absent in
// globals.css (rgba tint + a solid existing color var) — no new CSS
// custom properties introduced.
function statusPillStyle(status) {
  switch (status) {
    case 'pending':
      return { color: 'var(--text-dim)', background: 'rgba(92, 130, 153, 0.14)' };
    case 'approved':
      return { color: 'var(--text)', background: 'rgba(15, 58, 82, 0.10)' };
    case 'checked_in':
      return { color: 'var(--present)', background: 'rgba(34, 181, 115, 0.10)' };
    case 'closed':
      return { color: 'var(--present)', background: 'rgba(34, 181, 115, 0.16)' };
    case 'rejected':
      return { color: 'var(--absent)', background: 'rgba(239, 68, 68, 0.14)' };
    default:
      return { color: 'var(--text-dim)', background: 'rgba(92, 130, 153, 0.14)' };
  }
}

const TOKEN_STATUS_LABELS = {
  unused: 'غير مستخدم',
  scanned: 'انمسح',
  expired_no_show: 'انتهى (غياب)',
};

function tokenStatusPillStyle(status) {
  switch (status) {
    case 'unused':
      return { color: 'var(--text-dim)', background: 'rgba(92, 130, 153, 0.14)' };
    case 'scanned':
      return { color: 'var(--present)', background: 'rgba(34, 181, 115, 0.16)' };
    case 'expired_no_show':
      return { color: 'var(--absent)', background: 'rgba(239, 68, 68, 0.14)' };
    default:
      return { color: 'var(--text-dim)', background: 'rgba(92, 130, 153, 0.14)' };
  }
}

export default function FreelancerSessionDetailsPage({ params }) {
  const sessionId = params.id;
  const [session, setSession] = useState(null);
  const [levelCounts, setLevelCounts] = useState([]);
  const [qrTokens, setQrTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatingLevel, setGeneratingLevel] = useState(null);
  const [closing, setClosing] = useState(false);

  const loadSession = () => {
    setLoading(true);
    setError('');
    return fetch(`/api/freelancer/sessions/${sessionId}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'صار خطأ');
        setSession(data.session);
        setLevelCounts(data.levelCounts);
        setQrTokens(data.qrTokens);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const generateToken = async (level) => {
    setGeneratingLevel(level);
    try {
      const res = await fetch(`/api/freelancer/sessions/${sessionId}/qr-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setQrTokens((prev) => [
        ...prev,
        {
          id: data.token.id,
          level: data.token.level,
          token: data.token.token,
          status: 'unused',
          expires_at: data.token.expiresAt,
          scanned_at: null,
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingLevel(null);
    }
  };

  const closeSession = async () => {
    if (!window.confirm('متأكد إنك بدك تقفل الجلسة؟ هذا الإجراء نهائي ولا يمكن التراجع عنه')) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/freelancer/sessions/${sessionId}/close`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      loadSession();
    } catch (err) {
      setError(err.message);
    } finally {
      setClosing(false);
    }
  };

  const canOperate = session && ['approved', 'checked_in'].includes(session.status);

  return (
    <div className="page">
      <Header sub="تفاصيل الجلسة" />
      {error && <div className="msg error">{error}</div>}

      {loading && <div className="empty">جاري التحميل...</div>}

      {!loading && session && (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>
                  {new Date(session.session_date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{session.session_time.slice(0, 5)}</div>
              </div>
              <span className="status-pill" style={statusPillStyle(session.status)}>
                {STATUS_LABELS[session.status] || session.status}
              </span>
            </div>

            {session.status === 'rejected' && session.rejection_reason && (
              <div className="msg error" style={{ marginTop: 12, marginBottom: 0 }}>
                سبب الرفض: {session.rejection_reason}
              </div>
            )}
          </div>

          <div style={{ fontWeight: 'bold', margin: '18px 0 10px' }}>الأعداد المطلوبة</div>
          {levelCounts.map((lc) => {
            const generated = qrTokens.filter((t) => t.level === lc.level).length;
            const remaining = lc.child_count - generated;
            return (
              <div className="card" key={lc.level}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{lc.level}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                      مطلوب {lc.child_count} — متولّد {generated} — متبقي {Math.max(remaining, 0)}
                    </div>
                  </div>
                  {canOperate && remaining > 0 && (
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => generateToken(lc.level)}
                      disabled={generatingLevel === lc.level}
                      style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}
                    >
                      {generatingLevel === lc.level ? 'جاري التوليد...' : 'توليد رمز QR'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {qrTokens.length > 0 && (
            <>
              <div style={{ fontWeight: 'bold', margin: '18px 0 10px' }}>رموز QR المولّدة</div>
              {qrTokens.map((t) => (
                <div className="card" key={t.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{t.level}</div>
                      {t.scanned_at && (
                        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                          انمسح: {new Date(t.scanned_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    <span className="status-pill" style={tokenStatusPillStyle(t.status)}>
                      {TOKEN_STATUS_LABELS[t.status] || t.status}
                    </span>
                  </div>
                  {t.status === 'unused' && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <QRCodeSVG value={t.token} size={160} />
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {canOperate && (
            <Link href={`/freelancer/sessions/${sessionId}/scan`} className="btn" style={{ display: 'flex', marginTop: 8 }}>
              📷 الانتقال للمسح
            </Link>
          )}

          {canOperate && (
            <button
              className="btn secondary"
              type="button"
              onClick={closeSession}
              disabled={closing}
              style={{ marginTop: 8, borderColor: 'var(--absent)', color: 'var(--absent)' }}
            >
              {closing ? 'جاري الإغلاق...' : 'إغلاق الجلسة يدوياً'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
