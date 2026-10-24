// Joins LinkedIn export posts with calendar rows.
// Matching order: Live Post Link first, then Publication Date.
import { dateKey } from './dates.js';

export function matchPosts(linkedinPosts, calendarPosts) {
  const byUrl = new Map();
  const byDate = new Map();
  for (const p of linkedinPosts) {
    if (p.urlKey) byUrl.set(p.urlKey, p);
    const k = dateKey(p.date);
    if (k) {
      if (!byDate.has(k)) byDate.set(k, []);
      byDate.get(k).push(p);
    }
  }

  const claimed = new Set();
  const matchedCalendar = new Map(); // linkedin urlKey -> calendar post
  const unmatchedCalendar = [];
  const matchMethod = new Map();

  // Pass 1: URL
  for (const c of calendarPosts) {
    if (c.urlKey && byUrl.has(c.urlKey) && !claimed.has(c.urlKey)) {
      claimed.add(c.urlKey);
      matchedCalendar.set(c.urlKey, c);
      matchMethod.set(c.urlKey, 'url');
      c.matched = true;
    }
  }
  // Pass 2: date, only when exactly one unclaimed export post exists that day
  for (const c of calendarPosts) {
    if (c.matched) continue;
    const k = dateKey(c.date);
    const candidates = (k && byDate.get(k) ? byDate.get(k) : []).filter((p) => !claimed.has(p.urlKey));
    if (candidates.length === 1) {
      const p = candidates[0];
      claimed.add(p.urlKey);
      matchedCalendar.set(p.urlKey, c);
      matchMethod.set(p.urlKey, 'date');
      c.matched = true;
    } else {
      c.matchProblem = candidates.length > 1 ? 'Several LinkedIn posts share this date, so the link is needed to tell them apart.' : 'No LinkedIn post in the export has this link or date.';
      unmatchedCalendar.push(c);
    }
  }

  const merged = linkedinPosts.map((p) => mergePost(p, matchedCalendar.get(p.urlKey), matchMethod.get(p.urlKey)));
  const unmatchedLinkedin = merged.filter((p) => !p.calendar);
  return { posts: merged, unmatchedCalendar, unmatchedLinkedin };
}

// LinkedIn's numbers win; calendar numbers only fill gaps.
export function mergePost(li, cal, method) {
  const out = {
    ...li,
    hook: cal?.name || li.text || '',
    calendar: cal || null,
    matchMethod: method || null,
    contentType: cal?.contentType || null,
    funnel: cal?.funnel || null,
    pillars: cal?.pillars || [],
    initialPostType: cal?.postType || null,
    initialPersona: cal?.persona || null,
    metricSources: {},
  };
  for (const field of ['impressions', 'reactions', 'comments', 'reposts', 'saves', 'newFollowers']) {
    if (li[field] != null) {
      out[field] = li[field];
      out.metricSources[field] = 'linkedin';
    } else if (cal?.manual?.[field] != null) {
      out[field] = cal.manual[field];
      out.metricSources[field] = 'calendar';
    } else {
      out[field] = null;
    }
  }
  // Prefer a calendar timestamp when the export date has no time of day.
  if (cal?.date && cal.hasTime && (!li.hasTime)) {
    const liKey = li.date ? li.date.toDateString() : null;
    if (!liKey || liKey === cal.date.toDateString()) {
      out.date = cal.date;
      out.hasTime = true;
    }
  }
  if (!out.date && cal?.date) {
    out.date = cal.date;
    out.hasTime = cal.hasTime;
  }
  return out;
}
