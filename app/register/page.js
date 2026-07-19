'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Header from '../Header';

function compressImage(file, maxSize = 300, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_PHOTO_SIZE_MB = 10;

export default function RegisterPage() {
  const [activities, setActivities] = useState([]);
  const [fullName, setFullName] = useState('');
  const [parentContact, setParentContact] = useState('');
  const [selected, setSelected] = useState({}); // { [activityId]: packageId }
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const badgeRef = useRef(null);

  useEffect(() => {
    fetch('/api/activities', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setActivities(data.activities || []))
      .catch(() => {});
  }, []);

  const toggleActivity = (activityId, checked) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) {
        const activity = activities.find((a) => a.id === activityId);
        next[activityId] = activity?.packages?.[0]?.id || '';
      } else {
        delete next[activityId];
      }
      return next;
    });
  };

  const setPackageForActivity = (activityId, packageId) => {
    setSelected((prev) => ({ ...prev, [activityId]: packageId }));
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('لازم تختار ملف صورة');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      setError(`حجم الصورة كبير، الحد الأقصى ${MAX_PHOTO_SIZE_MB} ميغا`);
      return;
    }
    try {
      const compressed = await compressImage(file);
      setPhotoBase64(compressed);
      setPhotoPreview(compressed);
      setError('');
    } catch {
      setError('ما قدرنا نحمّل الصورة، جرب صورة تانية');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) {
      setError('اسم الطفل مطلوب');
      return;
    }
    const selections = Object.entries(selected)
      .filter(([, packageId]) => packageId)
      .map(([activityId, packageId]) => ({ activityId: Number(activityId), packageId: Number(packageId) }));

    setSubmitting(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          parentContact: parentContact.trim(),
          photoBase64,
          selections,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'صار خطأ');
      setResult(data.child);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadBadge = async () => {
    if (!badgeRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(badgeRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `qr-${result.full_name}.png`;
      link.click();
    } catch {
      alert('ما قدرنا ننشئ الصورة، جرب مرة تانية');
    } finally {
      setDownloading(false);
    }
  };

  if (result) {
    return (
      <div className="page">
        <Header sub="تم التسجيل بنجاح" />
        <div className="msg success">
          تم تسجيل {result.full_name} بنجاح ✓ — هاد الكود الخاص فيه، احتفظوا فيه أو صوروه، رح يُستخدم لتسجيل الحضور يومياً.
        </div>
        <div className="badge-card" ref={badgeRef}>
          {photoPreview && <img src={photoPreview} alt={result.full_name} className="photo" />}
          <div style={{ fontWeight: 'bold', fontSize: 16 }}>{result.full_name}</div>
          <div className="qr-wrap">
            <QRCodeSVG value={result.qr_token} size={160} />
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>Black Whale Academy 🐋</div>
        </div>
        <button className="btn secondary" type="button" onClick={downloadBadge} disabled={downloading} style={{ marginBottom: 10 }}>
          {downloading ? 'جاري التحضير...' : '📥 تحميل صورة'}
        </button>
        <a href="/register" className="btn secondary">تسجيل طفل تاني</a>
      </div>
    );
  }

  return (
    <div className="page">
      <Header sub="نموذج تسجيل طفل جديد" />
      {error && <div className="msg error">{error}</div>}
      <form onSubmit={submit}>
        <div className="card">
          <div className="field">
            <label>اسم الطفل الكامل *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: أحمد خالد"
            />
          </div>
          <div className="field">
            <label>رقم تواصل ولي الأمر</label>
            <input
              type="tel"
              value={parentContact}
              onChange={(e) => setParentContact(e.target.value)}
              placeholder="05xxxxxxxx"
            />
          </div>
          <div className="field">
            <label>صورة الطفل</label>
            <div className="photo-input">
              {photoPreview ? (
                <img src={photoPreview} alt="preview" className="photo-preview" />
              ) : (
                <div className="photo-preview" />
              )}
              <input type="file" accept="image/*" onChange={handlePhoto} />
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 'bold', marginBottom: 12 }}>الأنشطة (اختياري — ممكن تختار أكتر من نشاط)</div>
          {activities.length === 0 && <div className="empty">لا يوجد أنشطة متاحة حالياً</div>}
          {activities.map((a) => {
            const isChecked = Object.prototype.hasOwnProperty.call(selected, a.id);
            const hasPackages = a.packages && a.packages.length > 0;
            return (
              <div key={a.id} className="field" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: hasPackages ? 'pointer' : 'default' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={!hasPackages}
                    onChange={(e) => toggleActivity(a.id, e.target.checked)}
                  />
                  <span>
                    {a.emoji ? `${a.emoji} ` : ''}{a.name}
                    {a.schedule_text && (
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)', fontWeight: 'normal' }}>
                        {a.schedule_text}
                      </span>
                    )}
                  </span>
                </label>
                {!hasPackages && (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>لسا ما في باقات متاحة لهالنشاط</div>
                )}
                {isChecked && hasPackages && (
                  <select
                    value={selected[a.id] || ''}
                    onChange={(e) => setPackageForActivity(a.id, e.target.value)}
                    style={{ marginTop: 8 }}
                  >
                    {a.packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.session_count} حصص — {p.price} درهم
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'جاري التسجيل...' : 'تسجيل'}
        </button>
      </form>
    </div>
  );
}
