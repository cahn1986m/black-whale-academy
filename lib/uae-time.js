export function uaeSessionDateTimeToUtc(sessionDate, sessionTime) {
  const UAE_UTC_OFFSET_HOURS = 4;
  const dt = new Date(`${sessionDate}T${sessionTime}Z`);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setUTCHours(dt.getUTCHours() - UAE_UTC_OFFSET_HOURS);
  return dt;
}
