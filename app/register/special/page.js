import { cookies } from 'next/headers';
import RegisterSpecialForm from './RegisterSpecialForm';
import registerDict from '@/lib/locale/dictionaries/register.json';

// Deliberately not linked from anywhere in the app (not the home page, not
// /admin, not /register itself) — see RegisterSpecialForm.js's top comment.
// Server-rendered metadata for the same reason as /register/page.js: a
// client-only useEffect setting document.title loses a race against
// Next.js's own metadata sync on navigation (see that file's comment for
// the full root-cause explanation) — this avoids the race entirely.
export function generateMetadata() {
  const localeCookie = cookies().get('bwa_locale')?.value;
  const locale = localeCookie === 'en' ? 'en' : 'ar';
  return { title: registerDict[locale]?.pageTitle || registerDict.ar.pageTitle };
}

export default function RegisterSpecialPage() {
  return <RegisterSpecialForm />;
}
