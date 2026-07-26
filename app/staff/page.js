'use client';

import Link from 'next/link';
import Header from '../Header';

export default function StaffHomePage() {
  const logout = async () => {
    await fetch('/api/staff-logout', { method: 'POST' });
    window.location.href = '/staff/login';
  };

  return (
    <div className="page">
      <Header sub="بوابة الموظفين" />

      <Link href="/attendance" className="btn" style={{ display: 'flex', marginBottom: 12 }}>
        📋 تفقد الأكاديمية
      </Link>

      <button className="btn secondary" type="button" disabled style={{ marginBottom: 12 }}>
        🏊 تفقد الفريلانسرز (قريباً)
      </button>

      <button className="btn secondary" type="button" onClick={logout}>
        تسجيل الخروج
      </button>
    </div>
  );
}
