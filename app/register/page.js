import { cookies } from 'next/headers';
import RegisterForm from './RegisterForm';
import registerDict from '@/lib/locale/dictionaries/register.json';

// Server-rendered so the tab title is correct from the very first paint —
// see the "root cause" note in RegisterForm.js's title effect for why a
// client-only useEffect wasn't reliable here.
export function generateMetadata() {
  const localeCookie = cookies().get('bwa_locale')?.value;
  const locale = localeCookie === 'en' ? 'en' : 'ar';
  return { title: registerDict[locale]?.pageTitle || registerDict.ar.pageTitle };
}

export default function RegisterPage() {
  return <RegisterForm />;
}
