'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Header from '../Header';
import { useLocale, useTranslations } from '@/lib/locale/LocaleContext';
import { displayScheduleText } from '@/lib/locale/knownScheduleText';

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
  const { locale } = useLocale();
  const t = useTranslations('register');
  const tc = useTranslations('common');
  const STEP_LABELS = [t('stepTrainee'), t('stepParent'), t('stepMedical'), t('stepConsent')];

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
      setError(t('errPhotoType'));
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      setError(t('errPhotoSize', { maxMb: MAX_PHOTO_SIZE_MB }));
      return;
    }
    try {
      const compressed = await compressImage(file);
      setPhotoBase64(compressed);
      setPhotoPreview(compressed);
      setError('');
    } catch {
      setError(t('errPhotoUpload'));
    }
  };

  const validateStep1 = () => {
    if (!fullName.trim()) return t('errFullNameRequired');
    if (!dateOfBirth) return t('errDobRequired');
    if (!nationality.trim()) return t('errNationalityRequired');
    if (!gender) return t('errGenderRequired');
    return '';
  };

  const validateStep2 = () => {
    if (!parentFullName.trim()) return t('errParentFullNameRequired');
    if (!relationshipToChild.trim()) return t('errRelationshipRequired');
    if (!parentPhone.trim()) return t('errParentPhoneRequired');
    if (!parentEmail.trim()) return t('errParentEmailRequired');
    return '';
  };

  const validateStep3 = () => {
    if (hasMedicalCondition === '') return t('errMedicalAnswerRequired');
    if (hasMedicalCondition === 'yes' && !medicalConditionDetails.trim()) return t('errMedicalDetailsRequired');
    if (isOnMedication === '') return t('errMedicationAnswerRequired');
    if (isOnMedication === 'yes' && !medicationDetails.trim()) return t('errMedicationDetailsRequired');
    return '';
  };

  const validateStep4 = () => {
    if (!consentTermsAccepted) return t('errConsentRequired');
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
      if (!res.ok) throw new Error(data.error || tc('error'));
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
      alert(t('errBadgeDownload'));
    } finally {
      setDownloading(false);
    }
  };

  if (result) {
    return (
      <div className="page">
        <Header sub={t('successTitle')} />
        <div className="msg success">
          {t('successMessage', { name: result.full_name })}
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
          {downloading ? t('preparingImage') : t('downloadImage')}
        </button>
        <a href="/register" className="btn secondary">{t('registerAnother')}</a>
      </div>
    );
  }

  return (
    <div className="page">
      <Header sub={t('formTitle')} />
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
              <label>{t('fullNameLabel')}</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('fullNamePlaceholder')}
              />
            </div>
            <div className="field">
              <label>{t('dobLabel')}</label>
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('nationalityLabel')}</label>
              <input
                type="text"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder={t('nationalityPlaceholder')}
              />
            </div>
            <div className="field">
              <label>{t('genderLabel')}</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">{t('genderSelect')}</option>
                <option value="male">{t('genderMale')}</option>
                <option value="female">{t('genderFemale')}</option>
              </select>
            </div>
            <div className="field">
              <label>{t('photoLabel')}</label>
              <div className="photo-input">
                {photoPreview ? (
                  <img src={photoPreview} alt="preview" className="photo-preview" />
                ) : (
                  <div className="photo-preview" />
                )}
                <input type="file" accept="image/*" onChange={handlePhoto} />
              </div>
            </div>

            <div style={{ fontWeight: 'bold', margin: '18px 0 12px' }}>{t('activitiesTitle')}</div>
            {activities.length === 0 && <div className="empty">{t('noActivities')}</div>}
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
                          {displayScheduleText(a.schedule_text, locale)}
                        </span>
                      )}
                    </span>
                  </label>
                  {!hasPackages && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{t('noPackages')}</div>
                  )}
                  {isChecked && hasPackages && (
                    <select
                      value={selected[a.id] || ''}
                      onChange={(e) => setPackageForActivity(a.id, e.target.value)}
                      style={{ marginTop: 8 }}
                    >
                      {a.packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {t('packageOption', { count: p.session_count, price: p.price })}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}

            <button className="btn" type="button" onClick={goNext} style={{ marginTop: 12 }}>{tc('next')} →</button>
          </div>
        )}

        {step === 2 && (
          <div className="card">
            <div className="field">
              <label>{t('parentFullNameLabel')}</label>
              <input type="text" value={parentFullName} onChange={(e) => setParentFullName(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('relationshipLabel')}</label>
              <input
                type="text"
                value={relationshipToChild}
                onChange={(e) => setRelationshipToChild(e.target.value)}
                placeholder={t('relationshipPlaceholder')}
              />
            </div>
            <div className="field">
              <label>{t('parentPhoneLabel')}</label>
              <input
                type="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder={t('parentPhonePlaceholder')}
              />
            </div>
            <div className="field">
              <label>{t('parentEmailLabel')}</label>
              <input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('addressLabel')}</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn secondary" type="button" onClick={goBack} style={{ flex: 1 }}>← {tc('back')}</button>
              <button className="btn" type="button" onClick={goNext} style={{ flex: 1 }}>{tc('next')} →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card">
            <div className="field">
              <label>{t('hasMedicalConditionLabel')}</label>
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    name="hasMedicalCondition"
                    checked={hasMedicalCondition === 'yes'}
                    onChange={() => setHasMedicalCondition('yes')}
                  />
                  {tc('yes')}
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
                  {tc('no')}
                </label>
              </div>
            </div>
            {hasMedicalCondition === 'yes' && (
              <div className="field">
                <label>{t('medicalConditionDetailsLabel')}</label>
                <input
                  type="text"
                  value={medicalConditionDetails}
                  onChange={(e) => setMedicalConditionDetails(e.target.value)}
                />
              </div>
            )}

            <div className="field">
              <label>{t('isOnMedicationLabel')}</label>
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    name="isOnMedication"
                    checked={isOnMedication === 'yes'}
                    onChange={() => setIsOnMedication('yes')}
                  />
                  {tc('yes')}
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
                  {tc('no')}
                </label>
              </div>
            </div>
            {isOnMedication === 'yes' && (
              <div className="field">
                <label>{t('medicationDetailsLabel')}</label>
                <input type="text" value={medicationDetails} onChange={(e) => setMedicationDetails(e.target.value)} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn secondary" type="button" onClick={goBack} style={{ flex: 1 }}>← {tc('back')}</button>
              <button className="btn" type="button" onClick={goNext} style={{ flex: 1 }}>{tc('next')} →</button>
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
              <span>{t('consentTermsLabel')}</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input
                type="checkbox"
                checked={consentMarketingPhotos}
                onChange={(e) => setConsentMarketingPhotos(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>{t('consentMarketingLabel')}</span>
            </label>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn secondary" type="button" onClick={goBack} style={{ flex: 1 }}>← {tc('back')}</button>
              <button className="btn" type="submit" disabled={submitting} style={{ flex: 1 }}>
                {submitting ? t('submitting') : t('submit')}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
