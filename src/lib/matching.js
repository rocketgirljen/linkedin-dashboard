// Joins LinkedIn export posts with calendar rows.
// Matching order: same URL, same numeric post ID, then Publication Date
// (with the hook compared against the URL slug when several posts share a day).
// Calendar rows that match nothing are kept as calendar-only posts that use
// the numbers logged in Notion.
import { dateKey } from './dates.js';

// LinkedIn URLs carry a 19-digit ID: urn:li:activity:7380..., urn:li:share:7380...,
// or ...-activity-7380...-abcd. Share and activity IDs for the same post differ,
// so this only helps when both sides use the same kind of link.
export function postIdFromUrl(url) {
  const m = String(url || '').match(/(\d{15,})/);
  return m ? m[1] : null;
}

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'it', 'at', 'my', 'i', 'you', 'your', 'this', 'that', 'with', 'was', 'are', 'be', 'not', 'no', 'so', 'do', 'we', 'me', 'as', 'by']);

export function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

// "linkedin.com/posts/jennifer-wright_the-quiet-fixer-problem-activity-7380-abcd"
// gives "the quiet fixer problem".
export function slugFromUrl(url) {
  const m = String(url || '').match(/\/posts\/[^/?#]*?_([^/?#]*)/i);
  if (!m) return '';
  return m[1].replace(/-(activity|share|ugcpost)-\d+.*$/i, '').replace(/-/g, ' ');
}

// Share of hook words that appear in the URL slug, 0 to 1.
export function hookSlugScore(hook, url) {
  const slug = tokens(slugFromUrl(url));
  const words = tokens(hook);
  if (!slug.length || !words.length) return 0;
  const slugSet = new Set(slug);
  const hits = words.filter((w) => slugSet.has(w)).length;
  return hits / Math.min(words.length, Math.max(slug.length, 1));
}

function syntheticKey(c) {
  return `calendar:${dateKey(c.date) || 'undated'}:${String(c.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;
}

export function matchPosts(linkedinPosts, calendarPosts) {
  const byUrl = new Map();
  const byId = new Map();
  const byDate = new Map();
  for (const p of linkedinPosts) {
    if (p.urlKey) byUrl.set(p.urlKey, p);
    const id = postIdFromUrl(p.url);
    if (id) byId.set(id, p);
    const k = dateKey(p.date);
    if (k) {
      if (!byDate.has(k)) byDate.set(k, []);
      byDate.get(k).push(p);
    }
  }

  const claimed = new Set();
  const matchedCalendar = new Map(); // linkedin urlKey -> calendar post
  const matchMethod = new Map();
  const calendarOnly = [];

  const claim = (p, c, method) => {
    claimed.add(p.urlKey);
    matchedCalendar.set(p.urlKey, c);
    matchMethod.set(p.urlKey, method);
    c.matched = true;
  };

  // Pass 1: exact URL, then shared numeric ID
  for (const c of calendarPosts) {
    if (c.urlKey && byUrl.has(c.urlKey) && !claimed.has(c.urlKey)) { claim(byUrl.get(c.urlKey), c, 'url'); continue; }
    const id = postIdFromUrl(c.url);
    if (id && byId.has(id) && !claimed.has(byId.get(id).urlKey)) claim(byId.get(id), c, 'id');
  }

  // Pass 2: date. One candidate that day: take it. Several: compare the hook
  // with each candidate's URL slug and take the best when it clearly fits.
  for (const c of calendarPosts) {
    if (c.matched) continue;
    const k = dateKey(c.date);
    const candidates = (k && byDate.get(k) ? byDate.get(k) : []).filter((p) => !claimed.has(p.urlKey));
    if (candidates.length === 1) {
      claim(candidates[0], c, 'date');
    } else if (candidates.length > 1) {
      const scored = candidates.map((p) => ({ p, score: hookSlugScore(c.name, p.url) })).sort((a, b) => b.score - a.score);
      if (scored[0].score >= 0.3 && (scored.length === 1 || scored[0].score > scored[1].score)) {
        claim(scored[0].p, c, 'hook');
      } else {
        c.matchProblem = 'Several LinkedIn posts share this date and the hook does not match any of their links.';
        calendarOnly.push(c);
      }
    } else {
      c.matchProblem = c.date ? 'No LinkedIn post in the export has this link or date.' : 'No Publication Date in the calendar.';
      calendarOnly.push(c);
    }
  }

  const merged = linkedinPosts.map((p) => mergePost(p, matchedCalendar.get(p.urlKey), matchMethod.get(p.urlKey)));
  const unmatchedLinkedin = merged.filter((p) => !p.calendar);
  const calendarOnlyPosts = calendarOnly.map(calendarOnlyPost);
  return {
    posts: [...merged, ...calendarOnlyPosts],
    unmatchedCalendar: calendarOnly,
    unmatchedLinkedin,
  };
}

const METRIC_FIELDS = ['impressions', 'reactions', 'comments', 'reposts', 'saves', 'newFollowers'];

// A calendar row with no LinkedIn counterpart. Numbers come from Notion.
export function calendarOnlyPost(c) {
  const out = {
    source: 'calendar',
    url: c.url || '',
    urlKey: c.urlKey || syntheticKey(c),
    date: c.date || null,
    hasTime: Boolean(c.hasTime),
    hook: c.name || '',
    calendar: c,
    matchMethod: null,
    contentType: c.contentType || null,
    funnel: c.funnel || null,
    pillars: c.pillars || [],
    initialPostType: c.postType || null,
    initialPersona: c.persona || null,
    metricSources: {},
  };
  for (const field of METRIC_FIELDS) {
    const v = c.manual?.[field];
    out[field] = v == null ? null : v;
    if (v != null) out.metricSources[field] = 'calendar';
  }
  return out;
}

// LinkedIn's numbers win; calendar numbers only fill gaps.
export function mergePost(li, cal, method) {
  const out = {
    ...li,
    source: 'linkedin',
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
  for (const field of METRIC_FIELDS) {
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
