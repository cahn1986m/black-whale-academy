import Link from 'next/link';
import CopyRegisterLink from './CopyRegisterLink';
import Header from './Header';

export default function HomePage() {
  return (
    <div className="page">
      <Header sub="نظام تفقد الحضور اليومي" />

      <div className="nav-grid">
        <Link href="/attendance" className="nav-tile">
          <span className="emoji">✅</span>
          <span className="label">الحضور اليومي</span>
        </Link>
        <Link href="/admin" className="nav-tile">
          <span className="emoji">⚙️</span>
          <span className="label">الإدارة</span>
        </Link>
        <Link href="/history" className="nav-tile">
          <span className="emoji">📅</span>
          <span className="label">السجل</span>
        </Link>
        <Link href="/register" className="nav-tile">
          <span className="emoji">📝</span>
          <span className="label">تسجيل طفل</span>
        </Link>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <label style={{ fontSize: 13, color: 'var(--text-dim)', display: 'block', marginBottom: 8 }}>
          رابط التسجيل للأهل
        </label>
        <CopyRegisterLink />
      </div>
    </div>
  );
}
