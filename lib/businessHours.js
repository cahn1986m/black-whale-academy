// Real club operating hours, per day of week — a policy the admin can
// change on a whim (new season, Ramadan hours, etc.), so it deliberately
// lives here as a plain constant rather than a DB constraint. Every day:
// 4pm-10pm. Saturday and Sunday additionally open 10am-1pm.
// Each activity_time_slots row is always exactly 1 hour (see the schema's
// CHECK), so "allowed start hours" fully describes what's bookable.
const WEEKDAY_HOURS = [16, 17, 18, 19, 20, 21];
const WEEKEND_EXTRA_HOURS = [10, 11, 12];

export const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const ALLOWED_START_HOURS = {
  sunday: [...WEEKEND_EXTRA_HOURS, ...WEEKDAY_HOURS],
  monday: [...WEEKDAY_HOURS],
  tuesday: [...WEEKDAY_HOURS],
  wednesday: [...WEEKDAY_HOURS],
  thursday: [...WEEKDAY_HOURS],
  friday: [...WEEKDAY_HOURS],
  saturday: [...WEEKEND_EXTRA_HOURS, ...WEEKDAY_HOURS],
};

export function isWithinBusinessHours(dayOfWeek, startTime) {
  const hours = ALLOWED_START_HOURS[dayOfWeek];
  if (!hours) return false;
  const match = /^(\d{2}):00(:00)?$/.exec(startTime);
  if (!match) return false;
  return hours.includes(Number(match[1]));
}
