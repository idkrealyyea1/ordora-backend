'use strict';

/**
 * Timezone-aware opening-hours logic. The SERVER decides whether a
 * restaurant is open — the browser is never trusted for this.
 */

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const tzCache = new Map();
const tzWarned = new Set();

function isValidTimezone(tz) {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false;
  if (tzCache.has(tz)) return tzCache.get(tz);
  let ok = true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    ok = false;
  }
  tzCache.set(tz, ok);
  return ok;
}

/** Returns a valid IANA timezone or 'UTC', logging a warning on first invalid input. */
function resolveTimezone(tz) {
  if (isValidTimezone(tz)) return tz;
  if (!tzWarned.has(tz)) {
    console.warn('[datetime] Invalid timezone "' + tz + '", falling back to UTC');
    tzWarned.add(tz);
  }
  return 'UTC';
}

/** Accepts either a "HH:MM[:SS]" string or a pg-parsed Date; returns minutes since midnight. */
function timeToMinutes(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  if (!m) return null;
  const h = Number.parseInt(m[1], 10);
  const min = Number.parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Normalize a pg TIME value (Date or string) to "HH:MM". */
function timeToHhmm(value) {
  const minutes = timeToMinutes(value);
  if (minutes === null) return '00:00';
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** Current weekday (0=Sun) and minute-of-day in a given IANA timezone. */
function localDayAndMinutes(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  const day = WEEKDAYS.indexOf(String(parts.weekday || '').toLowerCase());
  let hour = Number.parseInt(parts.hour, 10);
  if (hour === 24) hour = 0; // some ICU versions emit 24 for midnight
  if (day < 0 || !Number.isFinite(hour)) return null;
  return { day, minutes: hour * 60 + Number.parseInt(parts.minute, 10) };
}

/**
 * Decide whether a restaurant is within opening hours right now.
 * rows: [{day_of_week, is_closed, opens_at, closes_at}] — all 7 days expected.
 * A window whose closes_at <= opens_at crosses midnight.
 */
function isOpenNow(hoursRows, timeZone, now = new Date()) {
  if (!Array.isArray(hoursRows) || hoursRows.length === 0) return false;
  const validTz = resolveTimezone(timeZone);
  const cur = localDayAndMinutes(now, validTz);
  if (!cur) return false;

  for (let offset = 0; offset <= 1; offset++) {
    const row = hoursRows.find((r) => r.day_of_week === ((cur.day - offset + 7) % 7));
    if (!row || row.is_closed) continue;
    const opens = timeToMinutes(row.opens_at);
    const closes = timeToMinutes(row.closes_at);
    if (opens === null || closes === null || opens === closes) continue;

    if (closes > opens) {
      if (offset === 0 && cur.minutes >= opens && cur.minutes < closes) return true;
    } else {
      // Overnight window (e.g. 18:00 → 02:00)
      if (offset === 0 && cur.minutes >= opens) return true;
      if (offset === 1 && cur.minutes < closes) return true;
    }
  }
  return false;
}

module.exports = { isValidTimezone, timeToMinutes, timeToHhmm, localDayAndMinutes, isOpenNow, resolveTimezone };
