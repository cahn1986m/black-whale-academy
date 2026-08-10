import { cookies } from 'next/headers';
import RegisterSpecialForm from './RegisterSpecialForm';
import registerDict from '@/lib/locale/dictionaries/register.json';

// Linked only from the home page's 5th nav tile — not from /admin or
// /register itself. Server-rendered metadata for the same reason as
// /register/page.js: a client-only useEffect setting document.title loses
// a race against Next.js's own metadata sync on navigation (see that
// file's comment for the full root-cause explanation) — this avoids the
// race entirely.
//
// Deliberately reuses the exact same title/description as plain
// /register (not anything mentioning "special needs") — same reasoning as
// the tab title: a link-preview card is the one surface a parent might
// screenshot/forward, so it must never disclose that this is the
// special-needs-specific form.
export function generateMetadata() {
  const localeCookie = cookies().get('bwa_locale')?.value;
  const locale = localeCookie === 'en' ? 'en' : 'ar';
  const dict = registerDict[locale] || registerDict.ar;
  return {
    title: dict.pageTitle,
    openGraph: { title: dict.pageTitle, description: dict.ogDescription },
  };
}

export default function RegisterSpecialPage() {
  return <RegisterSpecialForm />;
}
