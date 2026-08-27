/**
 * Date helpers for the prototype.
 *
 * Dates are held in state as plain 'YYYY-MM-DD' strings and only turned into
 * Date objects for arithmetic and formatting. Every Date is built at local
 * noon, so a timezone offset can never roll a date onto the previous day —
 * the bug that makes a 12 Oct departure display as 11 Oct west of UTC.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 'YYYY-MM-DD' -> Date at local noon. */
export function toDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Date -> 'YYYY-MM-DD'. */
export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso, days) {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function addMonths(iso, months) {
  const d = toDate(iso);
  d.setMonth(d.getMonth() + months);
  return toISO(d);
}

/** Whole nights between two dates. Never negative. */
export function nightsBetween(fromISO, toISODate) {
  const ms = toDate(toISODate) - toDate(fromISO);
  return Math.max(0, Math.round(ms / 86400000));
}

export function isBefore(a, b) {
  return toDate(a) < toDate(b);
}

export function isSameDay(a, b) {
  return a === b;
}

/** '12 Oct' */
export function formatShort(iso) {
  const d = toDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** 'Wed, 12 Oct' — the builder's check-in / check-out fields. */
export function formatWeekday(iso) {
  const d = toDate(iso);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** '12 – 17 Oct' within a month, '28 Oct – 3 Nov' across one. */
export function formatRange(fromISO, toISODate) {
  const a = toDate(fromISO);
  const b = toDate(toISODate);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
  }
  return `${formatShort(fromISO)} – ${formatShort(toISODate)}`;
}

/** '12 – 17 Oct 2026' — the detail screen's title line. */
export function formatRangeWithYear(fromISO, toISODate) {
  return `${formatRange(fromISO, toISODate)} ${toDate(toISODate).getFullYear()}`;
}

/** 'Oct 2026' — the package cards' departure month. */
export function formatMonthYear(iso) {
  const d = toDate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 'October 2026' — calendar headers. */
export function formatMonthLong(iso) {
  const d = toDate(iso);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * The calendar grid for the month containing `iso`: always six rows of seven,
 * so the popover does not change height as you page through months.
 * Days outside the month come back flagged so they can be dimmed.
 */
export function monthGrid(iso) {
  const anchor = toDate(iso);
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ iso: toISO(d), day: d.getDate(), outside: d.getMonth() !== anchor.getMonth() });
  }
  return cells;
}

export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Today, as an ISO string — the floor for date selection. */
export function today() {
  return toISO(new Date());
}
