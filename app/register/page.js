'use client';

import { useEffect, useState } from 'react';
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
  const [groups, setGroups] = useState([]);
  const [fullName, setFullName] = useState('');
  const [parentContact, setParentContact] = useState('');
  const [groupId, setGroupId] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then((data) => setGroups(data.groups || []))
      .catch(() => {});
  }, []);

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
    setSubmitting(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          parentContact: parentContact.trim(),
          groupId: groupId || null,
          photoBase64,
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

  if (result) {
    return (
      <div className="page">
        <Header sub="تم التسجيل بنجاح" />
        <div className="msg success">
          تم تسجيل {result.full_name} بنجاح ✓ — هاد الكود الخاص فيه، احتفظوا فيه أو صوروه، رح يُستخدم لتسجيل الحضور يومياً.
        </div>
        <div className="badge-card">
          {photoPreview && <img src={photoPreview} alt={result.full_name} className="photo" />}
          <div style={{ fontWeight: 'bold', fontSize: 16 }}>{result.full_name}</div>
          <div className="qr-wrap">
            <QRCodeSVG value={result.qr_token} size={160} />
          </div>
        </div>
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
            <label>المجموعة</label>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">بدون تحديد (رح يحددها المشرف لاحقاً)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
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
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'جاري التسجيل...' : 'تسجيل'}
        </button>
      </form>
    </div>
  );
}
