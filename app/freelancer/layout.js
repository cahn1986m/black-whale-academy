'use client';

import Link from 'next/link';

export default function FreelancerLayout({ children }) {
  const logout = async () => {
    await fetch('/api/freelancer/logout', { method: 'POST' });
    window.location.href = '/freelancer/login';
  };

  return (
    <div>
      <div className="tabs" style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 0' }}>
        <Link href="/freelancer" className="tab">الرئيسية</Link>
        <Link href="/freelancer/book" className="tab">حجز جلسة</Link>
        <Link href="/freelancer/sessions" className="tab">جلساتي</Link>
        <Link href="/freelancer/ledger" className="tab">كشف الحساب</Link>
        <Link href="/freelancer/notifications" className="tab">الإشعارات</Link>
        <button type="button" className="tab" onClick={logout}>تسجيل الخروج</button>
      </div>
      {children}
    </div>
  );
}
