'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Header from '../../../Header';

const SCAN_COOLDOWN_MS = 2500;

// --- Everything below in this block (camera error messages, playTone,
// playSuccessBeep, playWarningBeep, playErrorBeep) is copied verbatim
// from app/attendance/page.js — same html5-qrcode library, same Web
// Audio API tone-generation logic, unchanged. attendance/page.js does
// not export these (they're module-private there), so they're
// duplicated here rather than refactored into a shared module, which
// wasn't requested and would mean editing the existing attendance page.

const CAMERA_ERROR_MESSAGES = {
  NotAllowedError: 'تم رفض إذن الكاميرا. فعّل إذن الكاميرا من إعدادات المتصفح ثم حاول مرة تانية.',
  PermissionDeniedError: 'تم رفض إذن الكاميرا. فعّل إذن الكاميرا من إعدادات المتصفح ثم حاول مرة تانية.',
  NotFoundError: 'ما في كاميرا متوفرة على هالجهاز.',
  DevicesNotFoundError: 'ما في كاميرا متوفرة على هالجهاز.',
  NotReadableError: 'الكاميرا مستخدمة حالياً من تطبيق تاني. سكّر التطبيقات التانية وجرب مرة كمان.',
  TrackStartError: 'الكاميرا مستخدمة حالياً من تطبيق تاني. سكّر التطبيقات التانية وجرب مرة كمان.',
  OverconstrainedError: 'ما قدرنا نفتح الكاميرا المطلوبة على هالجهاز.',
  SecurityError: 'لازم تفتح الموقع عبر رابط آمن (HTTPS) عشان تشتغل الكاميرا.',
};

function getCameraErrorMessage(err) {
  if (!err) return 'ما قدرنا نفتح الكاميرا لسبب غير معروف.';
  const name = err.name || '';
  if (CAMERA_ERROR_MESSAGES[name]) return CAMERA_ERROR_MESSAGES[name];
  const detail = err.message || (typeof err === 'string' ? err : '');
  return detail ? `ما قدرنا نفتح الكاميرا: ${detail}` : 'ما قدرنا نفتح الكاميرا.';
}

function playTone(ctx, { start, duration, freq, type = 'square', peakGain = 0.35 }) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  const end = start + duration;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + Math.min(0.01, duration / 4));
  gain.gain.setValueAtTime(peakGain, Math.max(start, end - Math.min(0.03, duration / 4)));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(end);
}

function playSuccessBeep(ctx) {
  try {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const duration = 0.18;
    const gap = 0.08;
    playTone(ctx, { start: now, duration, freq: 1800 });
    playTone(ctx, { start: now + duration + gap, duration, freq: 1800 });
  } catch {}
}

function playWarningBeep(ctx) {
  try {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const duration = 0.1;
    const gap = 0.06;
    for (let i = 0; i < 3; i++) {
      playTone(ctx, { start: now + i * (duration + gap), duration, freq: 1100 });
    }
  } catch {}
}

function playErrorBeep(ctx) {
  try {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    playTone(ctx, { start: now, duration: 0.5, freq: 260, type: 'sawtooth', peakGain: 0.3 });
  } catch {}
}

// --- End of code copied verbatim from app/attendance/page.js.

export default function StaffFreelancerScanPage({ params }) {
  const sessionId = params.id;

  const [session, setSession] = useState(null);
  const [levelCounts, setLevelCounts] = useState([]);
  const [qrTokens, setQrTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [flash, setFlash] = useState(null);
  const scannerRef = useRef(null);
  const stopRequestedRef = useRef(false);
  const lastScanRef = useRef({ code: null, time: 0 });
  const audioCtxRef = useRef(null);
  const qrTokensRef = useRef([]);

  useEffect(() => {
    qrTokensRef.current = qrTokens;
  }, [qrTokens]);

  useEffect(() => {
    fetch(`/api/admin/freelancer-sessions/${sessionId}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'صار خطأ');
        setSession(data.session);
        setLevelCounts(data.levelCounts);
        setQrTokens(data.qrTokens);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Warm the html5-qrcode module in the background, same reasoning as
  // /attendance: keeps the dynamic import inside the click handler
  // near-instant so getUserMedia stays tied to the user gesture.
  useEffect(() => {
    import('html5-qrcode').catch(() => {});
  }, []);

  const canScan = session && ['approved', 'checked_in'].includes(session.status);

  const onDecoded = async (text) => {
    const now = Date.now();
    if (lastScanRef.current.code === text && now - lastScanRef.current.time < SCAN_COOLDOWN_MS) {
      return;
    }
    lastScanRef.current = { code: text, time: now };

    try {
      const res = await fetch(`/api/admin/freelancer-sessions/${sessionId}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: text }),
      });
      const data = await res.json();

      if (res.ok) {
        // Outcome 1: valid, unused token for this session.
        if (audioCtxRef.current) playSuccessBeep(audioCtxRef.current);
        setQrTokens((prev) =>
          prev.map((t) => (t.token === text ? { ...t, status: 'scanned', scanned_at: new Date().toISOString() } : t))
        );
        setFlash({ type: 'success', text: 'تم تسجيل الحضور ✓' });
      } else if (data.error === 'token has expired') {
        // Outcome 2: expired (still marked unused in the DB, but past its window).
        if (audioCtxRef.current) playWarningBeep(audioCtxRef.current);
        setFlash({ type: 'warning', text: 'هاد الرمز منتهي' });
      } else if (data.error === 'token already used or expired') {
        // Outcome 2: either already scanned, or already flagged expired_no_show —
        // disambiguate using the token's last-known local status.
        const existing = qrTokensRef.current.find((t) => t.token === text);
        if (existing && existing.status === 'scanned') {
          if (audioCtxRef.current) playWarningBeep(audioCtxRef.current);
          setFlash({ type: 'warning', text: 'هاد الرمز انمسح قبل هيك' });
        } else {
          if (audioCtxRef.current) playWarningBeep(audioCtxRef.current);
          setFlash({ type: 'warning', text: 'هاد الرمز منتهي' });
        }
      } else {
        // Outcome 3: unknown token, or belongs to another session/freelancer.
        if (audioCtxRef.current) playErrorBeep(audioCtxRef.current);
        setFlash({ type: 'error', text: 'رمز غير معروف' });
      }
    } catch {
      if (audioCtxRef.current) playErrorBeep(audioCtxRef.current);
      setFlash({ type: 'error', text: 'صار خطأ بالاتصال' });
    }
    setTimeout(() => setFlash(null), 2200);
  };

  const startScanner = async () => {
    if (starting || scanning) return;

    setCameraError('');

    if (typeof window === 'undefined' || !window.isSecureContext) {
      setCameraError('لازم تفتح الموقع عبر رابط آمن (HTTPS) عشان تشتغل الكاميرا.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('المتصفح ما بيدعم الوصول للكاميرا.');
      return;
    }

    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioCtxRef.current = new AudioCtx();
    }

    stopRequestedRef.current = false;
    setStarting(true);
    setScanning(true);

    const { Html5Qrcode } = await import('html5-qrcode');
    const instance = new Html5Qrcode('freelancer-qr-reader');
    scannerRef.current = instance;

    const config = { fps: 10, qrbox: 220, aspectRatio: 1.0 };
    const onScanFailure = () => {};

    const attempts = [
      { facingMode: { exact: 'environment' } },
      { facingMode: 'environment' },
      { facingMode: 'user' },
    ];

    let started = false;
    let lastError = null;

    for (const cameraConfig of attempts) {
      try {
        await instance.start(cameraConfig, config, onDecoded, onScanFailure);
        started = true;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!started) {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          await instance.start(cameras[0].id, config, onDecoded, onScanFailure);
          started = true;
        }
      } catch (err) {
        lastError = err;
      }
    }

    setStarting(false);

    if (started && stopRequestedRef.current) {
      try {
        await instance.stop();
      } catch {}
      try {
        await instance.clear();
      } catch {}
      scannerRef.current = null;
      setScanning(false);
      return;
    }

    if (!started) {
      scannerRef.current = null;
      setScanning(false);
      setCameraError(getCameraErrorMessage(lastError));
    }
  };

  const stopScanner = async () => {
    stopRequestedRef.current = true;

    if (starting) {
      setScanning(false);
      return;
    }

    const instance = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (!instance) return;
    try {
      await instance.stop();
    } catch {}
    try {
      await instance.clear();
    } catch {}
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopScanner();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopRequestedRef.current = true;
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (instance) {
        instance
          .stop()
          .catch(() => {})
          .finally(() => {
            instance.clear().catch(() => {});
          });
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <Link href="/staff/freelancer-scan" className="back-link">← قائمة الجلسات</Link>
      <Header sub="مسح رموز QR" />

      {error && <div className="msg error">{error}</div>}

      {loading && <div className="empty">جاري التحميل...</div>}

      {!loading && session && !canScan && (
        <>
          <div className="msg error">هاي الجلسة مش جاهزة للمسح</div>
          <Link href="/staff/freelancer-scan" className="btn secondary" style={{ display: 'flex' }}>
            رجوع لقائمة الجلسات
          </Link>
        </>
      )}

      {!loading && session && canScan && (
        <>
          <div style={{ marginBottom: 14 }}>
            {levelCounts.map((lc) => {
              const scannedCount = qrTokens.filter((t) => t.level === lc.level && t.status === 'scanned').length;
              return (
                <div className="summary-bar" key={lc.level} style={{ marginBottom: 8 }}>
                  <span>{lc.level}</span>
                  <span className="count">{scannedCount} / {lc.child_count}</span>
                </div>
              );
            })}
          </div>

          {flash && <div className={`msg ${flash.type === 'error' || flash.type === 'warning' ? 'error' : 'success'}`}>{flash.text}</div>}
          {cameraError && <div className="msg error">{cameraError}</div>}

          {!scanning ? (
            <button className="btn" onClick={startScanner} type="button" disabled={starting}>
              {starting ? 'جاري فتح الكاميرا...' : '📷 ابدأ المسح'}
            </button>
          ) : (
            <button className="btn secondary" onClick={stopScanner} type="button">
              إيقاف الكاميرا
            </button>
          )}

          <div id="freelancer-qr-reader" className="scanner-box" style={{ display: scanning ? 'block' : 'none', marginTop: 12 }} />
        </>
      )}
    </div>
  );
}
