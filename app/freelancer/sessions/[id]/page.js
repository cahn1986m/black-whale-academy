'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Header from '../../../Header';
import { useLocale, useTranslations } from '@/lib/locale/LocaleContext';

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
  const { locale } = useLocale();
  const t = useTranslations('freelancer');
  const tc = useTranslations('common');
  const dateLocale = locale === 'en' ? 'en-US' : 'ar-EG';

  const STATUS_LABELS = {
    pending: t('statusPending'),
    approved: t('statusApproved'),
    checked_in: t('statusCheckedIn'),
    closed: t('statusClosed'),
    rejected: t('statusRejected'),
  };
  const TOKEN_STATUS_LABELS = {
    unused: t('tokenUnused'),
    scanned: t('tokenScanned'),
    expired_no_show: t('tokenExpiredNoShow'),
  };

  const sessionId = params.id;
  const [session, setSession] = useState(null);
  const [levelCounts, setLevelCounts] = useState([]);
  const [qrTokens, setQrTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatingLevel, setGeneratingLevel] = useState(null);
  const [closing, setClosing] = useState(false);
  const [downloadingTokenId, setDownloadingTokenId] = useState(null);
  // One container per QR token, keyed by token.id — not a single shared
  // ref — so downloading token B's image never accidentally captures
  // token A's still-mounted container.
  const qrContainerRefs = useRef(new Map());

  const setQrContainerRef = (tokenId) => (el) => {
    if (el) {
      qrContainerRefs.current.set(tokenId, el);
    } else {
      qrContainerRefs.current.delete(tokenId);
    }
  };

  const loadSession = () => {
    setLoading(true);
    setError('');
    return fetch(`/api/freelancer/sessions/${sessionId}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || tc('error'));
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
      if (!res.ok) throw new Error(data.error || tc('error'));
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

  const downloadTokenImage = async (token) => {
    const container = qrContainerRefs.current.get(token.id);
    if (!container) return;
    setDownloadingTokenId(token.id);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(container, { backgroundColor: '#ffffff', scale: 2 });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `qr-freelancer-session-${sessionId}-${token.level}-${token.id}.png`;
      link.click();
    } catch {
      alert(t('errBadgeDownload'));
    } finally {
      setDownloadingTokenId(null);
    }
  };

  const closeSession = async () => {
    if (!window.confirm(t('closeSessionConfirm'))) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/freelancer/sessions/${sessionId}/close`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
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
      <Header sub={t('sessionDetailsSub')} />
      {error && <div className="msg error">{error}</div>}

      {loading && <div className="empty">{tc('loading')}</div>}

      {!loading && session && (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>
                  {new Date(session.session_date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{session.session_time.slice(0, 5)}</div>
              </div>
              <span className="status-pill" style={statusPillStyle(session.status)}>
                {STATUS_LABELS[session.status] || session.status}
              </span>
            </div>

            {session.status === 'rejected' && session.rejection_reason && (
              <div className="msg error" style={{ marginTop: 12, marginBottom: 0 }}>
                {t('rejectionReason', { reason: session.rejection_reason })}
              </div>
            )}
          </div>

          <div style={{ fontWeight: 'bold', margin: '18px 0 10px' }}>{t('requiredCounts')}</div>
          {levelCounts.map((lc) => {
            const generated = qrTokens.filter((tok) => tok.level === lc.level).length;
            const remaining = lc.child_count - generated;
            return (
              <div className="card" key={lc.level}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{lc.level}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                      {t('countsSummary', { required: lc.child_count, generated, remaining: Math.max(remaining, 0) })}
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
                      {generatingLevel === lc.level ? t('generating') : t('generateQrToken')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {qrTokens.length > 0 && (
            <>
              <div style={{ fontWeight: 'bold', margin: '18px 0 10px' }}>{t('generatedQrTokens')}</div>
              {qrTokens.map((tok) => (
                <div className="card" key={tok.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{tok.level}</div>
                      {tok.scanned_at && (
                        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                          {t('scannedAt', { time: new Date(tok.scanned_at).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }) })}
                        </div>
                      )}
                    </div>
                    <span className="status-pill" style={tokenStatusPillStyle(tok.status)}>
                      {TOKEN_STATUS_LABELS[tok.status] || tok.status}
                    </span>
                  </div>
                  {tok.status === 'unused' && (
                    <>
                      <div
                        ref={setQrContainerRef(tok.id)}
                        style={{ display: 'flex', justifyContent: 'center', background: '#ffffff', padding: 12 }}
                      >
                        <QRCodeSVG value={tok.token} size={160} />
                      </div>
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() => downloadTokenImage(tok)}
                        disabled={downloadingTokenId === tok.id}
                        style={{ marginTop: 10 }}
                      >
                        {downloadingTokenId === tok.id ? t('preparingImage') : t('downloadImage')}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </>
          )}

          {canOperate && (
            <button
              className="btn secondary"
              type="button"
              onClick={closeSession}
              disabled={closing}
              style={{ marginTop: 8, borderColor: 'var(--absent)', color: 'var(--absent)' }}
            >
              {closing ? t('closing') : t('closeSessionManually')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
