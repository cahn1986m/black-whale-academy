'use client';

import { useEffect, useRef, useState } from 'react';
import Header from '../Header';

const SCAN_COOLDOWN_MS = 2500;

export default function AttendancePage() {
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [flash, setFlash] = useState(null);
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ code: null, time: 0 });

  useEffect(() => {
    fetch('/api/groups')
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
    if (groupId) {
      loadRecords();
      try {
        window.localStorage?.setItem?.('bwa_group_id', groupId);
      } catch {}
    } else {
      setRecords([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance?groupId=${groupId}`);
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
    setScanning(true);
    const { Html5Qrcode } = await import('html5-qrcode');
    const instance = new Html5Qrcode('qr-reader');
    scannerRef.current = instance;
    try {
      await instance.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        (decodedText) => onDecoded(decodedText),
        () => {}
      );
    } catch (err) {
      setFlash({ type: 'error', text: 'ما قدرنا نفتح الكاميرا — تأكد من إذن الوصول' });
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    try {
      await scannerRef.current?.stop();
      await scannerRef.current?.clear();
    } catch {}
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  const presentCount = records.filter((r) => r.status === 'present').length;

  return (
    <div className="page">
      <a href="/" className="back-link">← الرئيسية</a>
      <Header sub="الحضور اليومي" />

      <div className="field">
        <label>اختر مجموعتك</label>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">-- اختر مجموعة --</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} {g.supervisor_name ? `(${g.supervisor_name})` : ''}
            </option>
          ))}
        </select>
      </div>

      {groupId && (
        <>
          <div className="summary-bar">
            <span>حاضر اليوم</span>
            <span className="count">{presentCount} / {records.length}</span>
          </div>

          {flash && <div className={`msg ${flash.type}`}>{flash.text}</div>}

          {!scanning ? (
            <button className="btn" onClick={startScanner} type="button">
              📷 ابدأ مسح QR
            </button>
          ) : (
            <button className="btn secondary" onClick={stopScanner} type="button">
              إيقاف الكاميرا
            </button>
          )}

          <div id="qr-reader" className="scanner-box" style={{ display: scanning ? 'block' : 'none', marginTop: 12 }} />

          <div style={{ marginTop: 16 }}>
            {loading && <div className="empty">جاري التحميل...</div>}
            {!loading && records.length === 0 && <div className="empty">ما في أطفال بهاي المجموعة بعد</div>}
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
        </>
      )}
    </div>
  );
}
