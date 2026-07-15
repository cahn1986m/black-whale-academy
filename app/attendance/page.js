'use client';

import { useEffect, useRef, useState } from 'react';
import Header from '../Header';

const SCAN_COOLDOWN_MS = 2500;

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

// Successful scan, sessions still available: two sharp high-pitched
// square-wave beeps — harsh/rich in harmonics so it cuts through loud
// ambient noise at the club, distinct in pitch and rhythm from the other two.
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

// Recognized child, attendance recorded, but their sessions are used up:
// three quick mid-pitched beeps — a distinct "pay attention" rhythm,
// lower and busier than the two-beep success sound.
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

// Unknown/invalid QR code (or not enrolled in this activity) — a single
// long, low buzz, unmistakably different from the two success/warning
// tones (low pitch + sawtooth "wrong" timbre + sustained length).
function playErrorBeep(ctx) {
  try {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    playTone(ctx, { start: now, duration: 0.5, freq: 260, type: 'sawtooth', peakGain: 0.3 });
  } catch {}
}

export default function AttendancePage() {
  const [activities, setActivities] = useState([]);
  const [activityId, setActivityId] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [flash, setFlash] = useState(null);
  const scannerRef = useRef(null);
  const stopRequestedRef = useRef(false);
  const lastScanRef = useRef({ code: null, time: 0 });
  const audioCtxRef = useRef(null);

  useEffect(() => {
    fetch('/api/activities', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        const withEnrollments = (data.activities || []).filter((a) => a.enrolled_count > 0);
        setActivities(withEnrollments);
        const saved = window.localStorage?.getItem?.('bwa_activity_id');
        if (saved && withEnrollments.some((a) => String(a.id) === saved)) {
          setActivityId(saved);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activityId) {
      loadRecords();
      try {
        window.localStorage?.setItem?.('bwa_activity_id', activityId);
      } catch {}
      const interval = setInterval(loadRecords, 15000);
      return () => clearInterval(interval);
    } else {
      setRecords([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  // Warm the html5-qrcode module in the background so that when the user
  // clicks "start scan", the dynamic import resolves near-instantly and the
  // getUserMedia call stays tied to the click's user-activation window
  // (required by Safari/iOS to show the camera permission prompt).
  useEffect(() => {
    import('html5-qrcode').catch(() => {});
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance?activityId=${activityId}`, { cache: 'no-store' });
      const data = await res.json();
      setRecords(data.records || []);
    } finally {
      setLoading(false);
    }
  };

  const markStatus = async (enrollmentId, status) => {
    await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentId, status }),
    });
    loadRecords();
  };

  const onDecoded = async (text) => {
    const now = Date.now();
    if (lastScanRef.current.code === text && now - lastScanRef.current.time < SCAN_COOLDOWN_MS) {
      return;
    }
    lastScanRef.current = { code: text, time: now };

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: text, activityId, status: 'present' }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (audioCtxRef.current) playErrorBeep(audioCtxRef.current);
        setFlash({ type: 'error', text: data.error || 'كود غير معروف' });
      } else if (data.sessionsRemaining != null && data.sessionsRemaining <= 0) {
        if (audioCtxRef.current) playWarningBeep(audioCtxRef.current);
        setFlash({ type: 'error', text: `⚠️ تم تسجيل ${data.child.full_name} حاضر — لكن ما إله حصص متبقية (اطلب تجديد الاشتراك)` });
        loadRecords();
      } else {
        if (audioCtxRef.current) playSuccessBeep(audioCtxRef.current);
        setFlash({ type: 'success', text: `تم تسجيل ${data.child.full_name} حاضر ✓` });
        loadRecords();
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

    // Create the AudioContext synchronously inside the click handler so the
    // browser ties it to the user gesture (needed for iOS Safari to allow
    // playback later, from the async decode callback).
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioCtxRef.current = new AudioCtx();
    }

    stopRequestedRef.current = false;
    setStarting(true);
    // Reveal the scanner container first so html5-qrcode can measure it
    // and size the video feed correctly once the camera starts.
    setScanning(true);

    const { Html5Qrcode } = await import('html5-qrcode');
    const instance = new Html5Qrcode('qr-reader');
    scannerRef.current = instance;

    // aspectRatio: 1.0 keeps the video locked to a square, matching the
    // fixed-size .scanner-box in CSS so the camera view never resizes
    // based on unrelated page content (e.g. a growing roster list below).
    const config = { fps: 10, qrbox: 220, aspectRatio: 1.0 };
    const onScanFailure = () => {};

    // Try the back camera first (ideal, not exact — degrades gracefully),
    // then the front camera, then whatever device is available (laptops
    // without a rear camera, etc).
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
      // User hit "stop" while the camera was still negotiating — honor it now.
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
      // Camera still negotiating; startScanner will clean up once it settles.
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

  const presentCount = records.filter((r) => r.status === 'present').length;

  return (
    <div className="page">
      <a href="/" className="back-link">← الرئيسية</a>
      <Header sub="الحضور اليومي" />

      <div className="field">
        <label>اختر النشاط</label>
        <select value={activityId} onChange={(e) => setActivityId(e.target.value)}>
          <option value="">-- اختر نشاط --</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.emoji ? `${a.emoji} ` : ''}{a.name} {a.instructor_name ? `(${a.instructor_name})` : ''}
            </option>
          ))}
        </select>
      </div>

      {!activityId && <div className="empty">اختر النشاط أولاً للبدء بالمسح</div>}

      {activityId && (
        <>
          <div className="summary-bar">
            <span>حاضر اليوم</span>
            <span className="count">{presentCount} / {records.length}</span>
          </div>

          {flash && <div className={`msg ${flash.type}`}>{flash.text}</div>}
          {cameraError && <div className="msg error">{cameraError}</div>}

          {!scanning ? (
            <button className="btn" onClick={startScanner} type="button" disabled={starting}>
              {starting ? 'جاري فتح الكاميرا...' : '📷 ابدأ مسح QR'}
            </button>
          ) : (
            <button className="btn secondary" onClick={stopScanner} type="button">
              إيقاف الكاميرا
            </button>
          )}

          <div id="qr-reader" className="scanner-box" style={{ display: scanning ? 'block' : 'none', marginTop: 12 }} />

          <div style={{ marginTop: 16 }}>
            {loading && <div className="empty">جاري التحميل...</div>}
            {!loading && records.length === 0 && <div className="empty">ما في أطفال مسجلين بهالنشاط بعد</div>}
            {records.map((r) => (
              <div className="child-row" key={r.enrollment_id}>
                {r.photo_base64 ? (
                  <img src={r.photo_base64} alt={r.full_name} />
                ) : (
                  <div className="child-avatar-fallback">🧒</div>
                )}
                <span className="name">
                  {r.full_name}
                  {r.sessions_remaining <= 0 && (
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--absent)' }}>خلصت الحصص</span>
                  )}
                </span>
                <button
                  type="button"
                  className={`status-pill ${r.status === 'present' ? 'present' : 'absent'}`}
                  onClick={() => markStatus(r.enrollment_id, r.status === 'present' ? 'absent' : 'present')}
                >
                  {r.status === 'present' ? 'حاضر' : 'غايب'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
