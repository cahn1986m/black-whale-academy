'use client';

import { useEffect, useState } from 'react';
import Header from '../Header';

export default function FreelancerHomePage() {
  const [freelancer, setFreelancer] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/freelancer/me', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'صار خطأ');
        setFreelancer(data.freelancer);
      })
      .catch((err) => setError(err.message));
  }, []);

  const logout = async () => {
    await fetch('/api/freelancer/logout', { method: 'POST' });
    window.location.href = '/freelancer/login';
  };

  return (
    <div className="page">
      <Header sub="لوحة المدرب المستقل" />
      {error && <div className="msg error">{error}</div>}
      <div className="card">
        {freelancer ? <p>مرحباً {freelancer.name}</p> : !error && <p>جاري التحميل...</p>}
        <button className="btn" onClick={logout}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
