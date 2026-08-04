import { Cairo } from 'next/font/google';
import { cookies } from 'next/headers';
import { LocaleProvider } from '@/lib/locale/LocaleContext';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '700', '900'],
  variable: '--font-cairo',
});

export function generateMetadata() {
  const localeCookie = cookies().get('bwa_locale')?.value;
  const locale = localeCookie === 'en' ? 'en' : 'ar';
  return locale === 'en'
    ? { title: 'Black Whale Academy | Attendance', description: 'Daily attendance system - Black Whale Academy' }
    : { title: 'الحوت الأسود | تفقد الحضور', description: 'نظام تفقد الحضور اليومي - نادي الحوت الأسود' };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  const localeCookie = cookies().get('bwa_locale')?.value;
  const locale = localeCookie === 'en' ? 'en' : 'ar';
  const dir = locale === 'en' ? 'ltr' : 'rtl';

  return (
    <html lang={locale} dir={dir} className={cairo.variable}>
      <body>
        <LocaleProvider initialLocale={locale}>
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
        </LocaleProvider>
      </body>
    </html>
  );
}
