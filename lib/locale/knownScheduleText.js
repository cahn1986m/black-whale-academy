// Fixed English translations for the handful of schedule_text values seeded
// by the admin "🚀 تعبئة الأنشطة السبعة تلقائياً" button (DEFAULT_ACTIVITIES
// in app/admin/page.js). This is NOT a general translation of database
// content — schedule_text is normally admin-typed and always displayed
// exactly as entered, in either language, same as activity names. These
// five strings are app-provided template text rather than arbitrary admin
// input, so a small curated lookup is justified specifically for them. Any
// schedule_text that doesn't match one of these keys exactly — including
// the moment an admin edits one of these activities' schedule afterward —
// falls straight back to displaying the raw value unchanged, in both
// languages, exactly like activity names.
const KNOWN_SCHEDULE_TEXT_EN = {
  'يومياً 4:00–9:00 مساءً، السبت والأحد 9:00 صباحاً–2:00 ظهراً': 'Daily 4:00–9:00 PM, Sat & Sun 9:00 AM–2:00 PM',
  'من عمر 6 أشهر فأكثر — مدة الحصة 30 دقيقة': 'Ages 6 months and up — 30-minute sessions',
  'السبت-الإثنين-الأربعاء 6:00–9:00 مساءً (ساعة لكل مجموعة)': 'Sat-Mon-Wed 6:00–9:00 PM (1 hour per group)',
  'السبت-الإثنين-الأربعاء': 'Sat-Mon-Wed',
  'الأحد-الثلاثاء-الخميس': 'Sun-Tue-Thu',
};

export function displayScheduleText(scheduleText, locale) {
  if (!scheduleText) return scheduleText;
  if (locale === 'en' && Object.prototype.hasOwnProperty.call(KNOWN_SCHEDULE_TEXT_EN, scheduleText)) {
    return KNOWN_SCHEDULE_TEXT_EN[scheduleText];
  }
  return scheduleText;
}
