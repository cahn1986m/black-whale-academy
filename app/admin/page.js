'use client';

import { useEffect, useState } from 'react';
import Header from '../Header';
import { useLocale, useTranslations } from '@/lib/locale/LocaleContext';
import { displayScheduleText } from '@/lib/locale/knownScheduleText';

// Seed-data content (activity names/schedules) — database content, never
// translated, matches whatever the admin would type in themselves. The one
// exception is schedule_text for these specific seeded activities, which
// gets a curated display-only translation via displayScheduleText() — see
// lib/locale/knownScheduleText.js for why that's scoped narrowly to these
// exact strings rather than being a general translation of DB content.
const DEFAULT_ACTIVITIES = [
  {
    name: 'السباحة',
    emoji: '🏊',
    scheduleText: 'يومياً 4:00–9:00 مساءً، السبت والأحد 9:00 صباحاً–2:00 ظهراً',
    packages: [{ sessionCount: 8, price: 300 }, { sessionCount: 12, price: 400 }],
  },
  {
    name: 'Baby Swimming',
    emoji: '👶',
    scheduleText: 'من عمر 6 أشهر فأكثر — مدة الحصة 30 دقيقة',
    packages: [{ sessionCount: 8, price: 599 }],
  },
  {
    name: 'كرة القدم',
    emoji: '⚽',
    scheduleText: 'السبت-الإثنين-الأربعاء 6:00–9:00 مساءً (ساعة لكل مجموعة)',
    packages: [],
  },
  {
    name: 'كرة السلة',
    emoji: '🏀',
    scheduleText: 'السبت-الإثنين-الأربعاء 6:00–9:00 مساءً (ساعة لكل مجموعة)',
    packages: [{ sessionCount: 12, price: 250 }],
  },
  {
    name: 'الجمباز',
    emoji: '🤸',
    scheduleText: 'السبت-الإثنين-الأربعاء',
    packages: [{ sessionCount: 8, price: 250 }],
  },
  {
    name: 'الكاراتيه',
    emoji: '🥋',
    scheduleText: 'الأحد-الثلاثاء-الخميس',
    packages: [{ sessionCount: 12, price: 250 }],
  },
  {
    name: 'الكيك بوكسينج',
    emoji: '🥊',
    scheduleText: 'السبت-الإثنين-الأربعاء',
    packages: [{ sessionCount: 12, price: 300 }],
  },
];

function getEffectivePrice(level, pricingOverrides, levelDefaultPricing) {
  const override = pricingOverrides?.find((o) => o.level === level);
  if (override) return Number(override.price);
  const def = levelDefaultPricing.find((d) => d.level === level);
  return def ? Number(def.price) : null;
}

// Fields that are required for new registrations but stay nullable at the DB
// level for legacy trainees (see schema.sql migration notes). Any of these
// being null on a real trainee row must surface as a visible "missing data"
// badge — never silently treated as "no"/empty, especially for the medical
// fields.
const REQUIRED_NULLABLE_FIELDS = [
  'date_of_birth', 'nationality', 'gender',
  'parent_full_name', 'relationship_to_child', 'parent_email',
  'has_medical_condition', 'is_on_medication', 'consent_terms_accepted',
];

function hasMissingData(c) {
  return REQUIRED_NULLABLE_FIELDS.some((f) => c[f] === null || c[f] === undefined || c[f] === '');
}

function formatDate(d, dateLocale) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' });
}

function BoolBadge({ value, yesLabel, noLabel, notAskedLabel }) {
  if (value === true) return <span className="status-pill present">{yesLabel}</span>;
  if (value === false) return <span className="status-pill absent">{noLabel}</span>;
  return (
    <span className="status-pill" style={{ background: 'rgba(234,179,8,0.18)', color: '#b45309' }}>
      ⚠️ {notAskedLabel}
    </span>
  );
}

function MissingField({ value, missingLabel, children }) {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: '#b45309' }}>⚠️ {missingLabel}</span>;
  }
  return children;
}

export default function AdminPage() {
  const { locale } = useLocale();
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const dateLocale = locale === 'en' ? 'en-US' : 'ar-EG';

  const [activities, setActivities] = useState([]);
  const [children, setChildren] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [activityForm, setActivityForm] = useState({ name: '', emoji: '', instructorName: '', scheduleText: '' });
  const [packageDraft, setPackageDraft] = useState({}); // { [activityId]: { sessionCount, price } }
  const [savingActivity, setSavingActivity] = useState(false);
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resettingFreelancers, setResettingFreelancers] = useState(false);

  const [pendingSessions, setPendingSessions] = useState([]);
  const [loadingPendingSessions, setLoadingPendingSessions] = useState(true);
  const [pendingSessionsError, setPendingSessionsError] = useState('');
  const [processingSessionId, setProcessingSessionId] = useState(null);
  const [pendingSessionDetails, setPendingSessionDetails] = useState({});
  const [levelDefaultPricing, setLevelDefaultPricing] = useState([]);

  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [loadingPendingRegistrations, setLoadingPendingRegistrations] = useState(true);
  const [pendingRegistrationsError, setPendingRegistrationsError] = useState('');
  const [processingRegistrationChildId, setProcessingRegistrationChildId] = useState(null);

  const [expandedChildId, setExpandedChildId] = useState(null);
  const [childEnrollments, setChildEnrollments] = useState([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [addEnrollActivityId, setAddEnrollActivityId] = useState('');
  const [addEnrollPackageId, setAddEnrollPackageId] = useState('');
  const [renewingActivityId, setRenewingActivityId] = useState(null);
  const [renewPackageId, setRenewPackageId] = useState('');
  const [editingOffsetActivityId, setEditingOffsetActivityId] = useState(null);
  const [offsetDraft, setOffsetDraft] = useState('');

  const [editingInfoChildId, setEditingInfoChildId] = useState(null);
  const [infoDraft, setInfoDraft] = useState(null);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState('');

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [showStaffPasswordForm, setShowStaffPasswordForm] = useState(false);
  const [staffNewPassword, setStaffNewPassword] = useState('');
  const [staffPasswordError, setStaffPasswordError] = useState('');
  const [savingStaffPassword, setSavingStaffPassword] = useState(false);

  const load = async () => {
    const [aRes, cRes, iRes] = await Promise.all([
      fetch('/api/activities', { cache: 'no-store' }),
      fetch('/api/child-list', { cache: 'no-store' }),
      fetch('/api/admin/instructors', { cache: 'no-store' }),
    ]);
    const aData = await aRes.json();
    const cData = await cRes.json();
    const iData = await iRes.json();
    setActivities(aData.activities || []);
    setChildren(cData.children || []);
    setInstructors(iData.instructors || []);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingSessions = async () => {
    setLoadingPendingSessions(true);
    setPendingSessionsError('');
    try {
      const res = await fetch('/api/admin/freelancer-sessions?status=pending', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setPendingSessions(data.sessions);

      const [detailEntries, levelPricingData] = await Promise.all([
        Promise.all(
          data.sessions.map((s) =>
            Promise.all([
              fetch(`/api/admin/freelancer-sessions/${s.id}`, { cache: 'no-store' }),
              fetch(`/api/admin/freelancers/${s.freelancer_id}`, { cache: 'no-store' }),
            ])
              .then(async ([sessionRes, freelancerRes]) => {
                const sessionData = await sessionRes.json();
                const freelancerData = await freelancerRes.json();
                if (!sessionRes.ok) throw new Error(sessionData.error || tc('error'));
                if (!freelancerRes.ok) throw new Error(freelancerData.error || tc('error'));
                return [s.id, { levelCounts: sessionData.levelCounts, pricingOverrides: freelancerData.pricingOverrides }];
              })
              .catch(() => [s.id, { error: true }])
          )
        ),
        fetch('/api/admin/level-pricing', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      setPendingSessionDetails(Object.fromEntries(detailEntries));
      setLevelDefaultPricing(levelPricingData.pricing || []);
    } catch (err) {
      setPendingSessionsError(err.message);
    } finally {
      setLoadingPendingSessions(false);
    }
  };

  useEffect(() => {
    loadPendingSessions();
  }, []);

  const loadPendingRegistrations = async () => {
    setLoadingPendingRegistrations(true);
    setPendingRegistrationsError('');
    try {
      const res = await fetch('/api/admin/pending-registrations', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setPendingRegistrations(data.registrations || []);
    } catch (err) {
      setPendingRegistrationsError(err.message);
    } finally {
      setLoadingPendingRegistrations(false);
    }
  };

  useEffect(() => {
    loadPendingRegistrations();
  }, []);

  const addActivity = async (e) => {
    e.preventDefault();
    setError('');
    if (!activityForm.name.trim()) {
      setError(t('activityNameRequired'));
      return;
    }
    setSavingActivity(true);
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActivityForm({ name: '', emoji: '', instructorName: '', scheduleText: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingActivity(false);
    }
  };

  const seedDefaultActivities = async () => {
    const existingNames = new Set(activities.map((a) => a.name));
    const toCreate = DEFAULT_ACTIVITIES.filter((a) => !existingNames.has(a.name));
    if (toCreate.length === 0) {
      alert(t('allActivitiesExist'));
      return;
    }
    if (!window.confirm(t('confirmSeedActivities', { count: toCreate.length }))) return;

    setSeeding(true);
    try {
      for (const def of toCreate) {
        const res = await fetch('/api/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: def.name, emoji: def.emoji, scheduleText: def.scheduleText }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(t('addActivityFailed', { name: def.name, error: data.error }));
          continue;
        }
        for (const pkg of def.packages) {
          await fetch(`/api/activities/${data.activity.id}/packages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionCount: pkg.sessionCount, price: pkg.price }),
          });
        }
      }
      load();
    } finally {
      setSeeding(false);
    }
  };

  const deleteActivity = async (activity) => {
    if (!window.confirm(t('deleteConfirmActivity', { name: activity.name, count: activity.enrolled_count }))) return;
    const res = await fetch(`/api/activities/${activity.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(`${t('genericErrorPrefix')}: ${data.error}`);
      return;
    }
    load();
    if (expandedChildId) loadEnrollments(expandedChildId);
  };

  const updateActivityInstructor = async (activityId, instructorId) => {
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setActivities((prev) => prev.map((a) => (a.id === activityId ? { ...a, instructor_id: instructorId } : a)));
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    }
  };

  const updatePackageDraft = (activityId, field, value) => {
    setPackageDraft((prev) => ({
      ...prev,
      [activityId]: { ...(prev[activityId] || { sessionCount: '', price: '', sessionsPerWeek: '' }), [field]: value },
    }));
  };

  const addPackage = async (activityId) => {
    const draft = packageDraft[activityId] || {};
    const sessionCount = Number(draft.sessionCount);
    const price = Number(draft.price);
    const sessionsPerWeek = draft.sessionsPerWeek ? Number(draft.sessionsPerWeek) : null;
    if (!sessionCount || sessionCount <= 0) {
      alert(t('sessionCountRequired'));
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      alert(t('priceRequired'));
      return;
    }
    if (sessionsPerWeek !== null && (Number.isNaN(sessionsPerWeek) || sessionsPerWeek <= 0)) {
      alert(t('sessionsPerWeekInvalid'));
      return;
    }
    const res = await fetch(`/api/activities/${activityId}/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionCount, price, sessionsPerWeek }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`${t('genericErrorPrefix')}: ${data.error}`);
      return;
    }
    setPackageDraft((prev) => ({ ...prev, [activityId]: { sessionCount: '', price: '', sessionsPerWeek: '' } }));
    load();
  };

  const deletePackage = async (pkg) => {
    if (!window.confirm(t('deletePackageConfirm'))) return;
    const res = await fetch(`/api/packages/${pkg.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(`${t('genericErrorPrefix')}: ${data.error}`);
      return;
    }
    load();
  };

  const loadEnrollments = async (childId) => {
    setLoadingEnrollments(true);
    try {
      const res = await fetch(`/api/children/${childId}/enrollments`, { cache: 'no-store' });
      const data = await res.json();
      setChildEnrollments(data.enrollments || []);
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const toggleExpand = (childId) => {
    if (expandedChildId === childId) {
      setExpandedChildId(null);
      setChildEnrollments([]);
      return;
    }
    setExpandedChildId(childId);
    setAddEnrollActivityId('');
    setAddEnrollPackageId('');
    setRenewingActivityId(null);
    setRenewPackageId('');
    loadEnrollments(childId);
  };

  const addOrRenewEnrollment = async (childId, activityId, packageId) => {
    if (!activityId || !packageId) {
      alert(t('selectActivityAndPackage'));
      return;
    }
    const res = await fetch(`/api/children/${childId}/enrollments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId: Number(activityId), packageId: Number(packageId) }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`${t('genericErrorPrefix')}: ${data.error}`);
      return;
    }
    setAddEnrollActivityId('');
    setAddEnrollPackageId('');
    setRenewingActivityId(null);
    setRenewPackageId('');
    loadEnrollments(childId);
    load();
  };

  const saveOffset = async (childId, activityId) => {
    const sessionsUsedOffset = Number(offsetDraft);
    if (Number.isNaN(sessionsUsedOffset) || sessionsUsedOffset < 0) {
      alert(t('sessionsCountInvalid'));
      return;
    }
    const res = await fetch(`/api/children/${childId}/enrollments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId, sessionsUsedOffset }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`${t('genericErrorPrefix')}: ${data.error}`);
      return;
    }
    setEditingOffsetActivityId(null);
    loadEnrollments(childId);
  };

  const startEditInfo = (c) => {
    setInfoError('');
    setEditingInfoChildId(c.id);
    setInfoDraft({
      fullName: c.full_name || '',
      dateOfBirth: c.date_of_birth ? c.date_of_birth.slice(0, 10) : '',
      nationality: c.nationality || '',
      gender: c.gender || '',
      parentFullName: c.parent_full_name || '',
      relationshipToChild: c.relationship_to_child || '',
      parentPhone: c.parent_phone || '',
      parentEmail: c.parent_email || '',
      address: c.address || '',
      hasMedicalCondition: c.has_medical_condition,
      medicalConditionDetails: c.medical_condition_details || '',
      isOnMedication: c.is_on_medication,
      medicationDetails: c.medication_details || '',
      hasSpecialNeeds: c.has_special_needs,
      specialNeedsDetails: c.special_needs_details || '',
    });
  };

  const cancelEditInfo = () => {
    setEditingInfoChildId(null);
    setInfoDraft(null);
    setInfoError('');
  };

  const saveInfo = async (childId) => {
    setInfoError('');
    setSavingInfo(true);
    try {
      const res = await fetch(`/api/children/${childId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(infoDraft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setEditingInfoChildId(null);
      setInfoDraft(null);
      load();
    } catch (err) {
      setInfoError(err.message);
    } finally {
      setSavingInfo(false);
    }
  };

  const unenroll = async (childId, activityId) => {
    if (!window.confirm(t('unenrollConfirm'))) return;
    const res = await fetch(`/api/children/${childId}/enrollments?activityId=${activityId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(`${t('genericErrorPrefix')}: ${data.error}`);
      return;
    }
    loadEnrollments(childId);
    load();
  };

  const cancelEnrollmentWithReason = async (childId, activityId) => {
    const reason = window.prompt(t('cancelReasonPrompt'));
    if (reason === null) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) return;

    const res = await fetch(`/api/children/${childId}/enrollments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId, cancelReason: trimmedReason }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`${t('genericErrorPrefix')}: ${data.error}`);
      return;
    }
    loadEnrollments(childId);
    load();
  };

  const approveRegistration = async (childId) => {
    setProcessingRegistrationChildId(childId);
    try {
      const res = await fetch(`/api/admin/pending-registrations/${childId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setPendingRegistrations((prev) => prev.filter((r) => r.child_id !== childId));
      load();
      if (expandedChildId === childId) loadEnrollments(childId);
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    } finally {
      setProcessingRegistrationChildId(null);
    }
  };

  const rejectRegistration = async (childId) => {
    const reason = window.prompt(t('rejectReasonPrompt'));
    if (reason === null) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) return;

    setProcessingRegistrationChildId(childId);
    try {
      const res = await fetch(`/api/admin/pending-registrations/${childId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: trimmedReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setPendingRegistrations((prev) => prev.filter((r) => r.child_id !== childId));
      load();
      if (expandedChildId === childId) loadEnrollments(childId);
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    } finally {
      setProcessingRegistrationChildId(null);
    }
  };

  const resetAllData = async () => {
    const typed = window.prompt(t('resetAllConfirmPrompt'));
    if (typed !== 'DELETE ALL') {
      if (typed !== null) alert(t('resetAllTextMismatch'));
      return;
    }
    setResetting(true);
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE ALL' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(t('resetAllSuccess'));
      setExpandedChildId(null);
      setChildEnrollments([]);
      load();
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  const resetFreelancerTestData = async () => {
    const sure = window.confirm(t('resetFreelancerConfirm'));
    if (!sure) return;

    const resetPassword = window.prompt(t('resetFreelancerPasswordPrompt'));
    if (resetPassword === null) return;
    if (!resetPassword) {
      alert(t('resetFreelancerPasswordRequired'));
      return;
    }

    setResettingFreelancers(true);
    try {
      const res = await fetch('/api/admin/reset-freelancer-test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      alert(t('resetFreelancerSuccess'));
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    } finally {
      setResettingFreelancers(false);
    }
  };

  const approveSession = async (sessionId) => {
    setProcessingSessionId(sessionId);
    try {
      const res = await fetch(`/api/admin/freelancer-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setPendingSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    } finally {
      setProcessingSessionId(null);
    }
  };

  const rejectSession = async (sessionId) => {
    const reason = window.prompt(t('rejectReasonPrompt'));
    if (reason === null) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) return;

    setProcessingSessionId(sessionId);
    try {
      const res = await fetch(`/api/admin/freelancer-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejectionReason: trimmedReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tc('error'));
      setPendingSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      alert(`${t('genericErrorPrefix')}: ${err.message}`);
    } finally {
      setProcessingSessionId(null);
    }
  };

  const logout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' });
    window.location.href = '/';
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordMismatch'));
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch('/api/admin-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(t('passwordChangedSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const changeStaffPassword = async (e) => {
    e.preventDefault();
    setStaffPasswordError('');
    setSavingStaffPassword(true);
    try {
      const res = await fetch('/api/admin/staff-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: staffNewPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(t('staffPasswordChangedSuccess'));
      setStaffNewPassword('');
      setShowStaffPasswordForm(false);
    } catch (err) {
      setStaffPasswordError(err.message);
    } finally {
      setSavingStaffPassword(false);
    }
  };

  const enrolledActivityIds = new Set(childEnrollments.map((e) => e.activity_id));
  const availableForEnroll = activities.filter((a) => !enrolledActivityIds.has(a.id) && a.packages?.length > 0);
  const packagesForSelectedActivity = activities.find((a) => a.id === Number(addEnrollActivityId))?.packages || [];

  // Grouped by trainee — approving/rejecting is one decision about the
  // trainee's legitimacy, not a per-activity one, even when the same
  // trainee registered for several activities in the same submission.
  const pendingRegistrationsByChild = [];
  {
    const byChild = new Map();
    for (const r of pendingRegistrations) {
      if (!byChild.has(r.child_id)) {
        byChild.set(r.child_id, {
          childId: r.child_id,
          fullName: r.full_name,
          photoBase64: r.photo_base64,
          parentFullName: r.parent_full_name,
          parentPhone: r.parent_phone,
          activities: [],
        });
        pendingRegistrationsByChild.push(byChild.get(r.child_id));
      }
      byChild.get(r.child_id).activities.push(r);
    }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" className="back-link" style={{ marginBottom: 0 }}>← {tc('backHome')}</a>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setShowPasswordForm((v) => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer' }}
          >
            {t('changePasswordButton')}
          </button>
          <button
            type="button"
            onClick={() => setShowStaffPasswordForm((v) => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer' }}
          >
            {t('staffPasswordButton')}
          </button>
          <button
            type="button"
            onClick={logout}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer' }}
          >
            {t('logoutButton')}
          </button>
        </div>
      </div>

      {showPasswordForm && (
        <div className="card">
          <div style={{ fontWeight: 'bold', marginBottom: 12 }}>{t('changePasswordTitle')}</div>
          {passwordError && <div className="msg error">{passwordError}</div>}
          <form onSubmit={changePassword}>
            <div className="field">
              <label>{t('currentPasswordLabel')}</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('newPasswordLabel')}</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('confirmNewPasswordLabel')}</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button className="btn" type="submit" disabled={savingPassword}>
              {savingPassword ? t('saving') : t('saveNewPassword')}
            </button>
          </form>
        </div>
      )}

      {showStaffPasswordForm && (
        <div className="card">
          <div style={{ fontWeight: 'bold', marginBottom: 12 }}>{t('staffPasswordTitle')}</div>
          {staffPasswordError && <div className="msg error">{staffPasswordError}</div>}
          <form onSubmit={changeStaffPassword}>
            <div className="field">
              <label>{t('newPasswordLabel')}</label>
              <input type="password" value={staffNewPassword} onChange={(e) => setStaffNewPassword(e.target.value)} />
            </div>
            <button className="btn" type="submit" disabled={savingStaffPassword}>
              {savingStaffPassword ? t('saving') : t('saveStaffPassword')}
            </button>
          </form>
        </div>
      )}

      <Header sub={t('manageActivitiesTraineesSub')} />

      <button
        className="btn secondary"
        type="button"
        onClick={seedDefaultActivities}
        disabled={seeding}
        style={{ marginBottom: 14 }}
      >
        {seeding ? t('seedingActivities') : t('seedActivitiesButton')}
      </button>

      <div className="card">
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>{t('addNewActivity')}</div>
        {error && <div className="msg error">{error}</div>}
        <form onSubmit={addActivity}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('activityNameLabel')}</label>
              <input
                type="text"
                value={activityForm.name}
                onChange={(e) => setActivityForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('activityNamePlaceholder')}
              />
            </div>
            <div className="field" style={{ width: 70 }}>
              <label>{t('emojiLabel')}</label>
              <input
                type="text"
                value={activityForm.emoji}
                onChange={(e) => setActivityForm((f) => ({ ...f, emoji: e.target.value }))}
                placeholder="🏊"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowActivityDetails((v) => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, padding: 0, marginBottom: 12, cursor: 'pointer' }}
          >
            {showActivityDetails ? t('hideExtraDetails') : t('showExtraDetails')}
          </button>

          {showActivityDetails && (
            <>
              <div className="field">
                <label>{t('instructorNameOptionalLabel')}</label>
                <input
                  type="text"
                  value={activityForm.instructorName}
                  onChange={(e) => setActivityForm((f) => ({ ...f, instructorName: e.target.value }))}
                  placeholder={t('instructorNamePlaceholder')}
                />
              </div>
              <div className="field">
                <label>{t('scheduleOptionalLabel')}</label>
                <input
                  type="text"
                  value={activityForm.scheduleText}
                  onChange={(e) => setActivityForm((f) => ({ ...f, scheduleText: e.target.value }))}
                  placeholder={t('schedulePlaceholder')}
                />
              </div>
            </>
          )}

          <button className="btn" type="submit" disabled={savingActivity}>
            {savingActivity ? t('addingActivity') : t('addActivityButton')}
          </button>
        </form>
      </div>

      <div style={{ fontWeight: 'bold', margin: '18px 0 10px' }}>{t('activitiesCount', { count: activities.length })}</div>
      {activities.length === 0 && <div className="empty">{t('noActivitiesYet')}</div>}
      {activities.map((a) => (
        <div className="card" key={a.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{a.emoji ? `${a.emoji} ` : ''}{a.name}</div>
              <select
                value={a.instructor_id || ''}
                onChange={(e) => updateActivityInstructor(a.id, e.target.value ? Number(e.target.value) : null)}
                style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                <option value="">{t('noInstructorAssigned')}</option>
                {instructors.filter((i) => i.active).map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>{t('enrolledCountLabel', { count: a.enrolled_count })}</div>
              {a.schedule_text && (
                <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>{displayScheduleText(a.schedule_text, locale)}</div>
              )}
            </div>
            <button className="btn ghost" type="button" onClick={() => deleteActivity(a)} style={{ width: 'auto', padding: '8px 12px', fontSize: 12 }}>
              {tc('delete')}
            </button>
          </div>

          <div className="tabs" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            {a.packages.map((p) => (
              <span className="tab" key={p.id}>
                {p.session_count} · {p.price} {tc('currencyAed')}{p.sessions_per_week ? ` · ${p.sessions_per_week}/${locale === 'en' ? 'wk' : 'أسبوع'}` : ''}{' '}
                <button
                  type="button"
                  onClick={() => deletePackage(p)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginInlineStart: 4 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              type="number"
              min="1"
              placeholder={t('sessionCountPlaceholder')}
              value={packageDraft[a.id]?.sessionCount || ''}
              onChange={(e) => updatePackageDraft(a.id, 'sessionCount', e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
            <input
              type="number"
              min="0"
              placeholder={t('pricePlaceholder')}
              value={packageDraft[a.id]?.price || ''}
              onChange={(e) => updatePackageDraft(a.id, 'price', e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              type="number"
              min="1"
              placeholder={t('sessionsPerWeekPlaceholder')}
              value={packageDraft[a.id]?.sessionsPerWeek || ''}
              onChange={(e) => updatePackageDraft(a.id, 'sessionsPerWeek', e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
            <button className="btn secondary" type="button" onClick={() => addPackage(a.id)} style={{ width: 'auto', padding: '8px 14px', fontSize: 13, flexShrink: 0 }}>
              {t('addPackageButton')}
            </button>
          </div>
        </div>
      ))}

      <button className="btn secondary" type="button" onClick={load} style={{ marginTop: 8 }}>
        {t('refreshLists')}
      </button>
      <button
        className="btn secondary"
        type="button"
        onClick={resetAllData}
        disabled={resetting}
        style={{ marginTop: 8, marginInlineStart: 8, borderColor: 'var(--absent)', color: 'var(--absent)' }}
      >
        {resetting ? t('deletingData') : t('deleteAllData')}
      </button>

      <div style={{ fontWeight: 'bold', margin: '22px 0 10px' }}>
        {t('traineesRegisteredCount', { count: children.length })}
      </div>
      {children.length === 0 && <div className="empty">{t('noTraineesYet')}</div>}
      {children.map((c) => (
        <div key={c.id}>
          <div className="child-row" onClick={() => toggleExpand(c.id)} style={{ cursor: 'pointer' }}>
            {c.photo_base64 ? (
              <img src={c.photo_base64} alt={c.full_name} />
            ) : (
              <div className="child-avatar-fallback">🧒</div>
            )}
            <span className="name">{c.full_name}</span>
            {hasMissingData(c) && (
              <span
                className="status-pill"
                style={{ background: 'rgba(234,179,8,0.18)', color: '#b45309', marginInlineStart: 8 }}
              >
                ⚠️ {t('missingData')}
              </span>
            )}
            <a
              href={`/admin/child/${c.id}`}
              onClick={(e) => e.stopPropagation()}
              className="btn ghost"
              style={{ width: 'auto', padding: '8px 12px', fontSize: 12 }}
            >
              QR
            </a>
          </div>

          {expandedChildId === c.id && (
            <div className="card" style={{ marginTop: -4 }}>
              <div style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 'bold' }}>{t('traineeInfo')}</div>
                  {editingInfoChildId !== c.id && (
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => startEditInfo(c)}
                      style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }}
                    >
                      {t('editInfo')}
                    </button>
                  )}
                </div>

                {editingInfoChildId === c.id ? (
                  <div>
                    {infoError && <div className="msg error">{infoError}</div>}
                    <div className="field">
                      <label>{t('fullNameLabel')}</label>
                      <input type="text" value={infoDraft.fullName} onChange={(e) => setInfoDraft((d) => ({ ...d, fullName: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>{t('dobLabel')}</label>
                      <input type="date" value={infoDraft.dateOfBirth} onChange={(e) => setInfoDraft((d) => ({ ...d, dateOfBirth: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>{t('nationalityLabel')}</label>
                      <input type="text" value={infoDraft.nationality} onChange={(e) => setInfoDraft((d) => ({ ...d, nationality: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>{t('genderLabel')}</label>
                      <select value={infoDraft.gender} onChange={(e) => setInfoDraft((d) => ({ ...d, gender: e.target.value }))}>
                        <option value="">{t('genderSelect')}</option>
                        <option value="male">{t('genderMale')}</option>
                        <option value="female">{t('genderFemale')}</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>{t('parentFullNameLabel')}</label>
                      <input type="text" value={infoDraft.parentFullName} onChange={(e) => setInfoDraft((d) => ({ ...d, parentFullName: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>{t('relationshipLabel')}</label>
                      <input type="text" value={infoDraft.relationshipToChild} onChange={(e) => setInfoDraft((d) => ({ ...d, relationshipToChild: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>{t('parentPhoneLabel')}</label>
                      <input type="tel" value={infoDraft.parentPhone} onChange={(e) => setInfoDraft((d) => ({ ...d, parentPhone: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>{t('parentEmailLabel')}</label>
                      <input type="email" value={infoDraft.parentEmail} onChange={(e) => setInfoDraft((d) => ({ ...d, parentEmail: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>{t('addressOptionalLabel')}</label>
                      <input type="text" value={infoDraft.address} onChange={(e) => setInfoDraft((d) => ({ ...d, address: e.target.value }))} />
                    </div>

                    <div className="field">
                      <label>{t('hasMedicalConditionLabel')}</label>
                      <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="radio"
                            name={`hasMedicalCondition-${c.id}`}
                            checked={infoDraft.hasMedicalCondition === true}
                            onChange={() => setInfoDraft((d) => ({ ...d, hasMedicalCondition: true }))}
                          />
                          {tc('yes')}
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="radio"
                            name={`hasMedicalCondition-${c.id}`}
                            checked={infoDraft.hasMedicalCondition === false}
                            onChange={() => setInfoDraft((d) => ({ ...d, hasMedicalCondition: false, medicalConditionDetails: '' }))}
                          />
                          {tc('no')}
                        </label>
                      </div>
                    </div>
                    {infoDraft.hasMedicalCondition === true && (
                      <div className="field">
                        <label>{t('medicalConditionDetailsLabel')}</label>
                        <input
                          type="text"
                          value={infoDraft.medicalConditionDetails}
                          onChange={(e) => setInfoDraft((d) => ({ ...d, medicalConditionDetails: e.target.value }))}
                        />
                      </div>
                    )}

                    <div className="field">
                      <label>{t('isOnMedicationLabel')}</label>
                      <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="radio"
                            name={`isOnMedication-${c.id}`}
                            checked={infoDraft.isOnMedication === true}
                            onChange={() => setInfoDraft((d) => ({ ...d, isOnMedication: true }))}
                          />
                          {tc('yes')}
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="radio"
                            name={`isOnMedication-${c.id}`}
                            checked={infoDraft.isOnMedication === false}
                            onChange={() => setInfoDraft((d) => ({ ...d, isOnMedication: false, medicationDetails: '' }))}
                          />
                          {tc('no')}
                        </label>
                      </div>
                    </div>
                    {infoDraft.isOnMedication === true && (
                      <div className="field">
                        <label>{t('medicationDetailsLabel')}</label>
                        <input
                          type="text"
                          value={infoDraft.medicationDetails}
                          onChange={(e) => setInfoDraft((d) => ({ ...d, medicationDetails: e.target.value }))}
                        />
                      </div>
                    )}

                    <div className="field">
                      <label>{t('hasSpecialNeedsLabel')}</label>
                      <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="radio"
                            name={`hasSpecialNeeds-${c.id}`}
                            checked={infoDraft.hasSpecialNeeds === true}
                            onChange={() => setInfoDraft((d) => ({ ...d, hasSpecialNeeds: true }))}
                          />
                          {tc('yes')}
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="radio"
                            name={`hasSpecialNeeds-${c.id}`}
                            checked={infoDraft.hasSpecialNeeds === false}
                            onChange={() => setInfoDraft((d) => ({ ...d, hasSpecialNeeds: false, specialNeedsDetails: '' }))}
                          />
                          {tc('no')}
                        </label>
                      </div>
                    </div>
                    {infoDraft.hasSpecialNeeds === true && (
                      <div className="field">
                        <label>{t('specialNeedsDetailsLabel')}</label>
                        <input
                          type="text"
                          value={infoDraft.specialNeedsDetails}
                          onChange={(e) => setInfoDraft((d) => ({ ...d, specialNeedsDetails: e.target.value }))}
                        />
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="btn secondary" type="button" onClick={cancelEditInfo} style={{ flex: 1 }}>{tc('cancel')}</button>
                      <button className="btn" type="button" onClick={() => saveInfo(c.id)} disabled={savingInfo} style={{ flex: 1 }}>
                        {savingInfo ? t('saving') : t('save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>{t('dobDisplayLabel')} <MissingField value={c.date_of_birth} missingLabel={t('missingData')}>{formatDate(c.date_of_birth, dateLocale)}</MissingField></div>
                    <div>{t('nationalityDisplayLabel')} <MissingField value={c.nationality} missingLabel={t('missingData')}>{c.nationality}</MissingField></div>
                    <div>{t('genderDisplayLabel')} <MissingField value={c.gender} missingLabel={t('missingData')}>{c.gender === 'male' ? t('genderMale') : c.gender === 'female' ? t('genderFemale') : null}</MissingField></div>
                    <div>{t('parentDisplayLabel')} <MissingField value={c.parent_full_name} missingLabel={t('missingData')}>{c.parent_full_name}</MissingField></div>
                    <div>{t('relationshipDisplayLabel')} <MissingField value={c.relationship_to_child} missingLabel={t('missingData')}>{c.relationship_to_child}</MissingField></div>
                    <div>{t('parentPhoneDisplayLabel')} {c.parent_phone}</div>
                    <div>{t('parentEmailDisplayLabel')} <MissingField value={c.parent_email} missingLabel={t('missingData')}>{c.parent_email}</MissingField></div>
                    <div>{t('addressDisplayLabel')} {c.address || '—'}</div>
                    <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span>{t('hasMedicalConditionQuestion')}</span> <BoolBadge value={c.has_medical_condition} yesLabel={tc('yes')} noLabel={tc('no')} notAskedLabel={t('notAskedYet')} />
                      </div>
                      {c.has_medical_condition && <div style={{ color: 'var(--text-dim)' }}>{c.medical_condition_details}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 4 }}>
                        <span>{t('isOnMedicationQuestion')}</span> <BoolBadge value={c.is_on_medication} yesLabel={tc('yes')} noLabel={tc('no')} notAskedLabel={t('notAskedYet')} />
                      </div>
                      {c.is_on_medication && <div style={{ color: 'var(--text-dim)' }}>{c.medication_details}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 4 }}>
                        <span>{t('specialNeedsQuestion')}</span> <BoolBadge value={c.has_special_needs} yesLabel={tc('yes')} noLabel={tc('no')} notAskedLabel={t('notAskedYet')} />
                      </div>
                      {c.has_special_needs && <div style={{ color: 'var(--text-dim)' }}>{c.special_needs_details}</div>}
                    </div>
                    <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span>{t('consentTermsQuestion')}</span> <BoolBadge value={c.consent_terms_accepted} yesLabel={tc('yes')} noLabel={tc('no')} notAskedLabel={t('notAskedYet')} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{t('consentMarketingQuestion')}</span> <BoolBadge value={c.consent_marketing_photos} yesLabel={tc('yes')} noLabel={tc('no')} notAskedLabel={t('notAskedYet')} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {loadingEnrollments && <div className="empty">{tc('loading')}</div>}
              {!loadingEnrollments && childEnrollments.length === 0 && (
                <div className="empty">{t('noEnrollmentsYet')}</div>
              )}
              {!loadingEnrollments && childEnrollments.map((e) => {
                const activity = activities.find((a) => a.id === e.activity_id);
                const packages = activity?.packages || [];
                return (
                  <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', rowGap: 6 }}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{e.emoji ? `${e.emoji} ` : ''}{e.activity_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                          {t('sessionsCountLine', { used: e.sessions_used, total: e.sessions_total })}
                          {e.price_paid != null ? ` — ${e.price_paid} ${tc('currencyAed')}` : ''}
                          {e.expiry_date ? ` — ${t('expiresOn', { date: formatDate(e.expiry_date, dateLocale) })}` : ''}
                        </div>
                        {e.status !== 'active' && e.status_reason && (
                          <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>{t('statusReasonLine', { reason: e.status_reason })}</div>
                        )}
                      </div>
                      {e.status === 'pending_approval' ? (
                        <span className="status-pill" style={{ background: 'rgba(234,179,8,0.18)', color: '#b45309', marginInlineStart: 'auto', marginInlineEnd: 8 }}>
                          {t('statusPendingApproval')}
                        </span>
                      ) : e.status === 'cancelled' ? (
                        <span className="status-pill absent" style={{ marginInlineStart: 'auto', marginInlineEnd: 8 }}>
                          {t('statusCancelled')}
                        </span>
                      ) : e.status === 'rejected' ? (
                        <span className="status-pill absent" style={{ marginInlineStart: 'auto', marginInlineEnd: 8 }}>
                          {t('statusRejected')}
                        </span>
                      ) : (
                        <span
                          className={`status-pill ${e.date_expired || e.sessions_remaining <= 0 ? 'absent' : 'present'}`}
                          style={{ marginInlineStart: 'auto', marginInlineEnd: 8 }}
                        >
                          {e.date_expired ? t('timeExpiredStatus') : e.sessions_remaining > 0 ? t('remainingStatus', { count: e.sessions_remaining }) : t('sessionsExpiredStatus')}
                        </span>
                      )}
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => {
                          setRenewingActivityId(renewingActivityId === e.activity_id ? null : e.activity_id);
                          setRenewPackageId('');
                        }}
                        style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }}
                      >
                        {t('renewButton')}
                      </button>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => {
                          const next = editingOffsetActivityId === e.activity_id ? null : e.activity_id;
                          setEditingOffsetActivityId(next);
                          setOffsetDraft(next ? String(e.sessions_used_offset) : '');
                        }}
                        style={{ width: 'auto', padding: '6px 10px', fontSize: 11, marginInlineStart: 6 }}
                      >
                        {t('manualCheckButton')}
                      </button>
                      {e.status === 'active' && (
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={() => cancelEnrollmentWithReason(c.id, e.activity_id)}
                          style={{ width: 'auto', padding: '6px 10px', fontSize: 11, marginInlineStart: 6, color: 'var(--absent)' }}
                        >
                          {t('cancelWithReasonButton')}
                        </button>
                      )}
                      <button className="btn ghost" type="button" onClick={() => unenroll(c.id, e.activity_id)} style={{ width: 'auto', padding: '6px 10px', fontSize: 11, marginInlineStart: 6 }}>
                        {t('unenrollButton')}
                      </button>
                    </div>
                    {renewingActivityId === e.activity_id && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <select
                          value={renewPackageId}
                          onChange={(ev) => setRenewPackageId(ev.target.value)}
                          style={{ flex: 1 }}
                        >
                          <option value="">{t('selectRenewPackage')}</option>
                          {packages.map((p) => (
                            <option key={p.id} value={p.id}>{p.session_count} — {p.price} {tc('currencyAed')}</option>
                          ))}
                        </select>
                        <button
                          className="btn secondary"
                          type="button"
                          onClick={() => addOrRenewEnrollment(c.id, e.activity_id, renewPackageId)}
                          style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}
                        >
                          {t('confirmButton')}
                        </button>
                      </div>
                    )}
                    {editingOffsetActivityId === e.activity_id && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>
                          {t('manualOffsetNote')}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="number"
                            min="0"
                            value={offsetDraft}
                            onChange={(ev) => setOffsetDraft(ev.target.value)}
                            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                          />
                          <button
                            className="btn secondary"
                            type="button"
                            onClick={() => saveOffset(c.id, e.activity_id)}
                            style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}
                          >
                            {t('save')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {availableForEnroll.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, marginBottom: 6, color: 'var(--text-dim)' }}>{t('addEnrollmentNewActivity')}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select
                      value={addEnrollActivityId}
                      onChange={(e) => { setAddEnrollActivityId(e.target.value); setAddEnrollPackageId(''); }}
                      style={{ flex: 1, minWidth: 120 }}
                    >
                      <option value="">{t('selectActivity')}</option>
                      {availableForEnroll.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <select
                      value={addEnrollPackageId}
                      onChange={(e) => setAddEnrollPackageId(e.target.value)}
                      disabled={!addEnrollActivityId}
                      style={{ flex: 1, minWidth: 120 }}
                    >
                      <option value="">{t('selectPackage')}</option>
                      {packagesForSelectedActivity.map((p) => (
                        <option key={p.id} value={p.id}>{p.session_count} — {p.price} {tc('currencyAed')}</option>
                      ))}
                    </select>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => addOrRenewEnrollment(c.id, addEnrollActivityId, addEnrollPackageId)}
                      style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}
                    >
                      {t('subscribeButton')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <a href="/admin/freelancers" className="btn" style={{ display: 'flex', marginTop: 22 }}>
        {t('manageFreelancersLink')}
      </a>

      <a href="/admin/instructors" className="btn" style={{ display: 'flex', marginTop: 12 }}>
        {t('manageInstructorsLink')}
      </a>

      <a href="/admin/reports" className="btn" style={{ display: 'flex', marginTop: 12 }}>
        {t('reportsLink')}
      </a>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>{t('pendingRegistrationsTitle')}</div>

        {pendingRegistrationsError && <div className="msg error">{pendingRegistrationsError}</div>}
        {loadingPendingRegistrations && <div className="empty">{tc('loading')}</div>}
        {!loadingPendingRegistrations && !pendingRegistrationsError && pendingRegistrationsByChild.length === 0 && (
          <div className="empty">{t('noPendingRegistrations')}</div>
        )}

        {!loadingPendingRegistrations && pendingRegistrationsByChild.map((group) => (
          <div key={group.childId} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            {group.photoBase64 ? (
              <img src={group.photoBase64} alt={group.fullName} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div className="child-avatar-fallback" style={{ flexShrink: 0 }}>🧒</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 'bold' }}>{group.fullName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {t('parentContactLine', { name: group.parentFullName || '—', phone: group.parentPhone || '—' })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                {group.activities.map((a) => `${a.emoji ? a.emoji + ' ' : ''}${a.activity_name}`).join(' · ')}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => approveRegistration(group.childId)}
                  disabled={processingRegistrationChildId === group.childId}
                  style={{ width: 'auto', padding: '8px 14px', fontSize: 13, borderColor: 'var(--present)', color: 'var(--present)' }}
                >
                  {processingRegistrationChildId === group.childId ? t('approving') : t('approveButton')}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => rejectRegistration(group.childId)}
                  disabled={processingRegistrationChildId === group.childId}
                  style={{ width: 'auto', padding: '8px 14px', fontSize: 13, borderColor: 'var(--absent)', color: 'var(--absent)' }}
                >
                  {processingRegistrationChildId === group.childId ? t('rejecting') : t('rejectButton')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>{t('freelancerRequests')}</div>

        {pendingSessionsError && <div className="msg error">{pendingSessionsError}</div>}
        {loadingPendingSessions && <div className="empty">{tc('loading')}</div>}
        {!loadingPendingSessions && !pendingSessionsError && pendingSessions.length === 0 && (
          <div className="empty">{t('noPendingRequests')}</div>
        )}

        {!loadingPendingSessions && pendingSessions.map((s) => (
          <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 'bold' }}>{s.freelancer_name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              {new Date(s.session_date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })} — {s.session_time.slice(0, 5)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, marginBottom: 8 }}>
              {pendingSessionDetails[s.id]?.error && t('couldntFetchDetails')}
              {pendingSessionDetails[s.id]?.levelCounts && (() => {
                const detail = pendingSessionDetails[s.id];
                let total = 0;
                let incomplete = false;
                const rows = detail.levelCounts.map((lc) => {
                  const price = getEffectivePrice(lc.level, detail.pricingOverrides, levelDefaultPricing);
                  if (price === null) {
                    incomplete = true;
                    return (
                      <div key={lc.level} style={{ color: 'var(--absent)', fontWeight: 'bold' }}>
                        {t('noPriceForLevel', { level: lc.level, count: lc.child_count })}
                      </div>
                    );
                  }
                  const subtotal = lc.child_count * price;
                  total += subtotal;
                  return (
                    <div key={lc.level}>
                      {t('levelCostLine', { level: lc.level, count: lc.child_count, price, subtotal })}
                    </div>
                  );
                });
                return (
                  <>
                    {rows}
                    <div style={{ fontWeight: 'bold', marginTop: 6, color: incomplete ? 'var(--absent)' : 'var(--text)' }}>
                      {incomplete ? t('incompleteTotalWarning') : t('totalExpectedCost', { total })}
                    </div>
                  </>
                );
              })()}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => approveSession(s.id)}
                disabled={processingSessionId === s.id}
                style={{ width: 'auto', padding: '8px 14px', fontSize: 13, borderColor: 'var(--present)', color: 'var(--present)' }}
              >
                {t('approveButton')}
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => rejectSession(s.id)}
                disabled={processingSessionId === s.id}
                style={{ width: 'auto', padding: '8px 14px', fontSize: 13, borderColor: 'var(--absent)', color: 'var(--absent)' }}
              >
                {t('rejectButton')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 22, borderColor: 'var(--absent)' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 8, color: 'var(--absent)' }}>{t('freelancerDangerZoneTitle')}</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
          {t('freelancerDangerZoneDesc')}
        </div>
        <button
          className="btn secondary"
          type="button"
          onClick={resetFreelancerTestData}
          disabled={resettingFreelancers}
          style={{ borderColor: 'var(--absent)', color: 'var(--absent)' }}
        >
          {resettingFreelancers ? t('resettingFreelancerData') : t('resetFreelancerDataButton')}
        </button>
      </div>
    </div>
  );
}
