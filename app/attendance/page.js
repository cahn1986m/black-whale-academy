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

export default function AttendancePage() {
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [flash, setFlash] = useState(null);
  const scannerRef = useRef(null);
  const stopRequestedRef = useRef(false);
  const lastScanRef = useRef({ code: null, time: 0 });

  useEffect(() => {
    fetch('/api/groups', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        setGroups(data.groups || []);
        const saved = window.localStorage?.getItem?.('bwa_group_id');
        if (saved && data.groups?.some((g) => String(g.id) === saved)) {
          setGroupId(saved);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRecords();
    try {
      if (groupId) window.localStorage?.setItem?.('bwa_group_id', groupId);
    } catch {}
    const interval = setInterval(loadRecords, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

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
      const url = groupId ? `/api/attendance?groupId=${groupId}` : '/api/attendance';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      setRecords(data.records || []);
    } finally {
      setLoading(false);
    }
  };

  const markStatus = async (childId, status) => {
    await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, status }),
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
        body: JSON.stringify({ qrToken: text, status: 'present' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFlash({ type: 'error', text: data.error || 'كود غير معروف' });
      } else {
        setFlash({ type: 'success', text: `تم تسجيل ${data.child.full_name} حاضر ✓` });
        loadRecords();
      }
    } catch {
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

    stopRequestedRef.current = false;
    setStarting(true);
    // Reveal the scanner container first so html5-qrcode can measure it
    // and size the video feed correctly once the camera starts.
    setScanning(true);

    const { Html5Qrcode } = await import('html5-qrcode');
    const instance = new Html5Qrcode('qr-reader');
    scannerRef.current = instance;

    const config = { fps: 10, qrbox: 220 };
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const presentCount = records.filter((r) => r.status === 'present').length;

  return (
    <div className="page">
      <a href="/" className="back-link">← الرئيسية</a>
      <Header sub="الحضور اليومي" />

      <div className="field">
        <label>فلترة حسب المجموعة (اختياري)</label>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">كل المجموعات</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} {g.supervisor_name ? `(${g.supervisor_name})` : ''}
            </option>
          ))}
        </select>
      </div>

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
        {!loading && records.length === 0 && <div className="empty">ما في أطفال بعد</div>}
        {records.map((r) => (
          <div className="child-row" key={r.child_id}>
            {r.photo_base64 ? (
              <img src={r.photo_base64} alt={r.full_name} />
            ) : (
              <div className="child-avatar-fallback">🧒</div>
            )}
            <span className="name">{r.full_name}</span>
            <button
              type="button"
              className={`status-pill ${r.status === 'present' ? 'present' : 'absent'}`}
              onClick={() => markStatus(r.child_id, r.status === 'present' ? 'absent' : 'present')}
            >
              {r.status === 'present' ? 'حاضر' : 'غايب'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
