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
const STEP_LABELS = ['المتدرب', 'ولي الأمر', 'معلومات طبية', 'الموافقات'];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [activities, setActivities] = useState([]);

  // Step 1 — trainee
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [nationality, setNationality] = useState('');
  const [gender, setGender] = useState('');
  const [selected, setSelected] = useState({}); // { [activityId]: packageId }
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);

  // Step 2 — parent
  const [parentFullName, setParentFullName] = useState('');
  const [relationshipToChild, setRelationshipToChild] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [address, setAddress] = useState('');

  // Step 3 — medical
  const [hasMedicalCondition, setHasMedicalCondition] = useState(''); // '' | 'yes' | 'no'
  const [medicalConditionDetails, setMedicalConditionDetails] = useState('');
  const [isOnMedication, setIsOnMedication] = useState(''); // '' | 'yes' | 'no'
  const [medicationDetails, setMedicationDetails] = useState('');

  // Step 4 — consent
  const [consentTermsAccepted, setConsentTermsAccepted] = useState(false);
  const [consentMarketingPhotos, setConsentMarketingPhotos] = useState(false);

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

  const validateStep1 = () => {
    if (!fullName.trim()) return 'اسم المتدرب مطلوب';
    if (!dateOfBirth) return 'تاريخ ميلاد المتدرب مطلوب';
    if (!nationality.trim()) return 'الجنسية مطلوبة';
    if (!gender) return 'الجنس مطلوب';
    return '';
  };

  const validateStep2 = () => {
    if (!parentFullName.trim()) return 'اسم ولي الأمر مطلوب';
    if (!relationshipToChild.trim()) return 'صلة القرابة مطلوبة';
    if (!parentPhone.trim()) return 'رقم تواصل ولي الأمر مطلوب';
    if (!parentEmail.trim()) return 'البريد الإلكتروني لولي الأمر مطلوب';
    return '';
  };

  const validateStep3 = () => {
    if (hasMedicalCondition === '') return 'الرجاء الإجابة عن سؤال الحالة الصحية';
    if (hasMedicalCondition === 'yes' && !medicalConditionDetails.trim()) return 'الرجاء ذكر تفاصيل الحالة الصحية';
    if (isOnMedication === '') return 'الرجاء الإجابة عن سؤال الأدوية';
    if (isOnMedication === 'yes' && !medicationDetails.trim()) return 'الرجاء ذكر تفاصيل الأدوية';
    return '';
  };

  const validateStep4 = () => {
    if (!consentTermsAccepted) return 'الموافقة على الشروط والأحكام مطلوبة للمتابعة';
    return '';
  };

  const goNext = () => {
    setError('');
    const err = step === 1 ? validateStep1() : step === 2 ? validateStep2() : validateStep3();
    if (err) {
      setError(err);
      return;
    }
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const step4Error = validateStep4();
    if (step4Error) {
      setError(step4Error);
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
          dateOfBirth,
          nationality: nationality.trim(),
          gender,
          parentFullName: parentFullName.trim(),
          relationshipToChild: relationshipToChild.trim(),
          parentPhone: parentPhone.trim(),
          parentEmail: parentEmail.trim(),
          address: address.trim(),
          hasMedicalCondition: hasMedicalCondition === 'yes',
          medicalConditionDetails: hasMedicalCondition === 'yes' ? medicalConditionDetails.trim() : null,
          isOnMedication: isOnMedication === 'yes',
          medicationDetails: isOnMedication === 'yes' ? medicationDetails.trim() : null,
          consentTermsAccepted,
          consentMarketingPhotos,
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
        <a href="/register" className="btn secondary">تسجيل متدرب تاني</a>
      </div>
    );
  }

  return (
    <div className="page">
      <Header sub="نموذج تسجيل متدرب جديد" />
      {error && <div className="msg error">{error}</div>}

      <div className="tabs" style={{ marginBottom: 14 }}>
        {STEP_LABELS.map((label, idx) => (
          <span key={label} className={`tab ${step === idx + 1 ? 'active' : ''}`}>
            {idx + 1}. {label}
          </span>
        ))}
      </div>

      <form onSubmit={submit}>
        {step === 1 && (
          <div className="card">
            <div className="field">
              <label>اسم المتدرب الكامل *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: أحمد خالد"
              />
            </div>
            <div className="field">
              <label>تاريخ الميلاد *</label>
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
            <div className="field">
              <label>الجنسية *</label>
              <input
                type="text"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="مثال: إماراتي"
              />
            </div>
            <div className="field">
              <label>الجنس *</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">اختر</option>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </div>
            <div className="field">
              <label>صورة المتدرب</label>
              <div className="photo-input">
                {photoPreview ? (
                  <img src={photoPreview} alt="preview" className="photo-preview" />
                ) : (
                  <div className="photo-preview" />
                )}
                <input type="file" accept="image/*" onChange={handlePhoto} />
              </div>
            </div>

            <div style={{ fontWeight: 'bold', margin: '18px 0 12px' }}>الأنشطة (اختياري — ممكن تختار أكتر من نشاط)</div>
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

            <button className="btn" type="button" onClick={goNext} style={{ marginTop: 12 }}>التالي →</button>
          </div>
        )}

        {step === 2 && (
          <div className="card">
            <div className="field">
              <label>اسم ولي الأمر الكامل *</label>
              <input type="text" value={parentFullName} onChange={(e) => setParentFullName(e.target.value)} />
            </div>
            <div className="field">
              <label>صلة القرابة *</label>
              <input
                type="text"
                value={relationshipToChild}
                onChange={(e) => setRelationshipToChild(e.target.value)}
                placeholder="مثال: أب، أم، وصي"
              />
            </div>
            <div className="field">
              <label>رقم تواصل ولي الأمر *</label>
              <input
                type="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="05xxxxxxxx"
              />
            </div>
            <div className="field">
              <label>البريد الإلكتروني *</label>
              <input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>العنوان (اختياري)</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn secondary" type="button" onClick={goBack} style={{ flex: 1 }}>← رجوع</button>
              <button className="btn" type="button" onClick={goNext} style={{ flex: 1 }}>التالي →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card">
            <div className="field">
              <label>هل عند المتدرب حالة صحية يجب الانتباه لها؟ *</label>
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    name="hasMedicalCondition"
                    checked={hasMedicalCondition === 'yes'}
                    onChange={() => setHasMedicalCondition('yes')}
                  />
                  نعم
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    name="hasMedicalCondition"
                    checked={hasMedicalCondition === 'no'}
                    onChange={() => {
                      setHasMedicalCondition('no');
                      setMedicalConditionDetails('');
                    }}
                  />
                  لا
                </label>
              </div>
            </div>
            {hasMedicalCondition === 'yes' && (
              <div className="field">
                <label>تفاصيل الحالة الصحية *</label>
                <input
                  type="text"
                  value={medicalConditionDetails}
                  onChange={(e) => setMedicalConditionDetails(e.target.value)}
                />
              </div>
            )}

            <div className="field">
              <label>هل يتناول المتدرب أدوية بشكل منتظم؟ *</label>
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    name="isOnMedication"
                    checked={isOnMedication === 'yes'}
                    onChange={() => setIsOnMedication('yes')}
                  />
                  نعم
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    name="isOnMedication"
                    checked={isOnMedication === 'no'}
                    onChange={() => {
                      setIsOnMedication('no');
                      setMedicationDetails('');
                    }}
                  />
                  لا
                </label>
              </div>
            </div>
            {isOnMedication === 'yes' && (
              <div className="field">
                <label>تفاصيل الأدوية *</label>
                <input type="text" value={medicationDetails} onChange={(e) => setMedicationDetails(e.target.value)} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn secondary" type="button" onClick={goBack} style={{ flex: 1 }}>← رجوع</button>
              <button className="btn" type="button" onClick={goNext} style={{ flex: 1 }}>التالي →</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="card">
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
              <input
                type="checkbox"
                checked={consentTermsAccepted}
                onChange={(e) => setConsentTermsAccepted(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>أوافق على الشروط والأحكام الخاصة بأكاديمية الحوت الأسود *</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input
                type="checkbox"
                checked={consentMarketingPhotos}
                onChange={(e) => setConsentMarketingPhotos(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>أوافق على استخدام صور المتدرب لأغراض التسويق (اختياري)</span>
            </label>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn secondary" type="button" onClick={goBack} style={{ flex: 1 }}>← رجوع</button>
              <button className="btn" type="submit" disabled={submitting} style={{ flex: 1 }}>
                {submitting ? 'جاري التسجيل...' : 'تسجيل'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
