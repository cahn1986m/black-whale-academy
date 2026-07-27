import { Cairo } from 'next/font/google';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700', '900'],
  variable: '--font-cairo',
});

export const metadata = {
  title: 'الحوت الأسود | تفقد الحضور',
  description: 'نظام تفقد الحضور اليومي - نادي الحوت الأسود',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body>
        <div className="bg-decor" aria-hidden="true">
          <span>🏊</span>
          <span>⚽</span>
          <span>🏀</span>
          <span>🤸</span>
          <span>🥋</span>
          <span>🥊</span>
          <span>🌊</span>
        </div>
        {children}
      </body>
    </html>
  );
}
