'use client';

import { useEffect, useState } from 'react';
import Header from '../../Header';
import { useTranslations } from '@/lib/locale/LocaleContext';

const GENDER_LABEL_KEYS = { male: 'genderMale', female: 'genderFemale' };

export default function AdminReportsPage() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/admin/reports', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || tc('error'));
        setReport(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const genderLabel = (gender) => (GENDER_LABEL_KEYS[gender] ? t(GENDER_LABEL_KEYS[gender]) : t('unknownLabel'));

  return (
    <div className="page">
      <a href="/admin" className="back-link">← {t('backToManagement')}</a>
      <Header sub={t('reportsTitle')} />
      {error && <div className="msg error">{error}</div>}
      {loading && <div className="empty">{t('loadingReports')}</div>}

      {!loading && report && (
        <>
          <div className="card">
            <div style={{ fontWeight: 'bold', marginBottom: 12 }}>{t('ageDistributionTitle')}</div>
            {report.ageDistribution.length === 0 && report.ageUnknownCount === 0 ? (
              <div className="empty">{t('noTraineesYet')}</div>
            ) : (
              <>
                {report.ageDistribution.map((row) => (
                  <div key={row.age} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                    <span>{row.age} {t('ageYearsSuffix')}</span>
                    <span style={{ fontWeight: 'bold' }}>{row.count}</span>
                  </div>
                ))}
                {report.ageUnknownCount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: 'var(--text-dim)' }}>
                    <span>{t('unknownLabel')}</span>
                    <span style={{ fontWeight: 'bold' }}>{report.ageUnknownCount}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="card">
            <div style={{ fontWeight: 'bold', marginBottom: 12 }}>{t('genderDistributionTitle')}</div>
            {report.genderDistribution.map((row) => (
              <div key={row.gender} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>{genderLabel(row.gender)}</span>
                <span style={{ fontWeight: 'bold' }}>{row.count}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ fontWeight: 'bold', marginBottom: 12 }}>{t('nationalityDistributionTitle')}</div>
            {report.nationalityDistribution.map((row) => (
              <div key={row.nationality} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>{row.nationality === 'unknown' ? t('unknownLabel') : row.nationality}</span>
                <span style={{ fontWeight: 'bold' }}>{row.count}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ fontWeight: 'bold', marginBottom: 12 }}>{t('enrollmentsByActivityTitle')}</div>
            {report.enrollmentsByActivity.map((row) => (
              <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>{row.name}</span>
                <span style={{ fontWeight: 'bold' }}>{row.active_count}{row.pending_count > 0 ? ` (+${row.pending_count})` : ''}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ fontWeight: 'bold', marginBottom: 12 }}>{t('financialSummaryTitle')}</div>
            {report.financialByActivity.map((row) => (
              <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span>{row.name}</span>
                <span style={{ fontWeight: 'bold' }}>{Number(row.total).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', marginTop: 8, borderTop: '1px solid var(--border)', fontSize: 14 }}>
              <span style={{ fontWeight: 'bold' }}>{t('totalRevenueLabel')}</span>
              <span style={{ fontWeight: 'bold' }}>{Number(report.totalRevenue).toFixed(2)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
