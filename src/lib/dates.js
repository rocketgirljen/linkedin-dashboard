// Date helpers shared by the parsers and the metrics code.

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

// Convert an Excel serial date number to a JS Date (local time).
export function excelSerialToDate(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  const wholeDays = Math.floor(serial);
  const fraction = serial - wholeDays;
  // Excel day 0 is 1899-12-30 in the 1900 date system.
  const base = new Date(1899, 11, 30);
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + wholeDays);
  if (fraction > 0) {
    const totalSeconds = Math.round(fraction * 86400);
    date.setHours(Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60), totalSeconds % 60, 0);
  }
  return date;
}

// Try hard to turn whatever a spreadsheet or CSV hands us into a Date.
// Returns null when the value cannot be read as a date.
export function parseDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return excelSerialToDate(value);
  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (!text) return null;

  // ISO style: 2025-07-12 or 2025-07-12T09:00:00
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }

  // US style: 7/12/2025, 07/12/25, optionally followed by a time
  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/);
  if (m) {
    let year = +m[3];
    if (year < 100) year += 2000;
    let hour = +(m[4] || 0);
    hour = applyMeridiem(hour, m[7]);
    return new Date(year, +m[1] - 1, +m[2], hour, +(m[5] || 0), +(m[6] || 0));
  }

  // Notion style: "July 12, 2025 9:00 AM" or "Jul 12, 2025" or "12 July 2025"
  m = text.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([AaPp][Mm])?)?/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] != null) {
    const hour = applyMeridiem(+(m[4] || 0), m[6]);
    return new Date(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2], hour, +(m[5] || 0), 0);
  }
  m = text.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([AaPp][Mm])?)?/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] != null) {
    const hour = applyMeridiem(+(m[4] || 0), m[6]);
    return new Date(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1], hour, +(m[5] || 0), 0);
  }

  // Last resort: let the JS engine try.
  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function applyMeridiem(hour, meridiem) {
  if (!meridiem) return hour;
  const isPm = meridiem.toLowerCase() === 'pm';
  if (isPm && hour < 12) return hour + 12;
  if (!isPm && hour === 12) return 0;
  return hour;
}

// True when the string carried an explicit time of day.
export function hasTimeComponent(value) {
  if (value instanceof Date) return value.getHours() !== 0 || value.getMinutes() !== 0;
  if (typeof value === 'number') return value % 1 !== 0;
  if (typeof value !== 'string') return false;
  return /\d{1,2}:\d{2}/.test(value);
}

// YYYY-MM-DD in local time, used as a matching key.
export function dateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatShortDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
