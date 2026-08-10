import { cookies } from 'next/headers';
import RegisterForm from './RegisterForm';
import registerDict from '@/lib/locale/dictionaries/register.json';

// Server-rendered so the tab title is correct from the very first paint —
// see the "root cause" note in RegisterForm.js's title effect for why a
// client-only useEffect wasn't reliable here.
//
// openGraph is set explicitly here (not just `title`/`description`)
// because the root layout's generateMetadata() only returns plain
// title/description with no `openGraph` key of its own — Next.js then
// auto-derives a default openGraph object from those ROOT-level values
// and that's what child routes inherit unless they set their own
// `openGraph`, regardless of what they override `title` to. That's why
// link-preview cards were showing the generic "…| تفقد الحضور" site text
// even after the tab title was fixed to something page-specific.
export function generateMetadata() {
  const localeCookie = cookies().get('bwa_locale')?.value;
  const locale = localeCookie === 'en' ? 'en' : 'ar';
  const dict = registerDict[locale] || registerDict.ar;
  return {
    title: dict.pageTitle,
    openGraph: { title: dict.pageTitle, description: dict.ogDescription },
  };
}

export default function RegisterPage() {
  return <RegisterForm />;
}
