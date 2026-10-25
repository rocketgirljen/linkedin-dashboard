// Metric math. Every number on the dashboard comes from here.
import { DAYS_OF_WEEK, TIME_BUCKETS, HOOK_LIMIT } from './constants.js';

// engagement rate = (reactions + comments + reposts) / impressions
// When the export only gives a total "engagements" count, fall back to that.
export function engagementRate(post) {
  const imp = post.impressions;
  if (!imp || imp <= 0) return null;
  const parts = [post.reactions, post.comments, post.reposts];
  if (parts.every((v) => v == null)) {
    if (post.engagements != null) return post.engagements / imp;
    return null;
  }
  const sum = parts.reduce((acc, v) => acc + (v || 0), 0);
  return sum / imp;
}

export function commentsPerThousand(post) {
  if (!post.impressions || post.impressions <= 0 || post.comments == null) return null;
  return (post.comments / post.impressions) * 1000;
}

export function totalEngagements(post) {
  const parts = [post.reactions, post.comments, post.reposts];
  if (parts.every((v) => v == null)) return post.engagements ?? null;
  return parts.reduce((acc, v) => acc + (v || 0), 0);
}

// Attach derived values to a post so the UI can sort on them.
export function enrichPost(post) {
  const hook = post.hook || '';
  return {
    ...post,
    engagementRate: engagementRate(post),
    commentsPerThousand: commentsPerThousand(post),
    totalEngagements: totalEngagements(post),
    hookLength: hook.length,
    hookOverLimit: hook.length > HOOK_LIMIT,
    hookOpener: classifyHookOpener(hook),
    dayOfWeek: post.date ? DAYS_OF_WEEK[post.date.getDay()] : null,
    timeBucket: timeBucket(post),
  };
}

// Hook opener patterns: Question, Number, "I" statement, Contrarian, Other.
export function classifyHookOpener(hook) {
  const text = String(hook || '').trim();
  if (!text) return 'Other';
  const lower = text.toLowerCase();
  if (/^\d/.test(text) || /^(one|two|three|four|five|six|seven|eight|nine|ten)\b/.test(lower)) return 'Number';
  if (/\?\s*$/.test(text) || /^(what|why|how|when|where|who|which|do|does|did|is|are|can|could|should|would|have|has|will|ever)\b/.test(lower)) return 'Question';
  if (/^(i|i'm|i've|i'd|i'll|my)\b/.test(lower)) return 'I statement';
  if (/^(stop|no\b|never|nobody|most|everyone|unpopular|hot take|forget|don't|dont|you don't|you do not|it's not|its not|contrary|the problem with|myth|wrong|quit|here's why .* wrong)/.test(lower) || /\b(isn't|is not|doesn't|does not|wrong|myth|lie|overrated)\b/.test(lower)) return 'Contrarian';
  return 'Other';
}

export function timeBucket(post) {
  if (!post.date || !post.hasTime) return 'Unknown';
  const h = post.date.getHours();
  if (h >= 5 && h < 8) return TIME_BUCKETS[0];
  if (h >= 8 && h < 11) return TIME_BUCKETS[1];
  if (h >= 11 && h < 14) return TIME_BUCKETS[2];
  if (h >= 14 && h < 17) return TIME_BUCKETS[3];
  if (h >= 17 && h < 21) return TIME_BUCKETS[4];
  return TIME_BUCKETS[5];
}

function mean(values) {
  const list = values.filter((v) => v != null && Number.isFinite(v));
  if (!list.length) return null;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

function sum(values) {
  return values.filter((v) => v != null).reduce((a, b) => a + b, 0);
}

// Group posts by a field (string or function) and compute averages.
export function groupStats(posts, keyOf, { order } = {}) {
  const getKey = typeof keyOf === 'function' ? keyOf : (p) => p[keyOf];
  const groups = new Map();
  for (const p of posts) {
    let key = getKey(p);
    if (Array.isArray(key)) {
      for (const k of key) addTo(groups, k, p);
    } else {
      addTo(groups, key, p);
    }
  }
  let rows = [...groups.entries()].map(([key, list]) => ({
    key,
    count: list.length,
    avgEngagementRate: mean(list.map((p) => p.engagementRate)),
    avgComments: mean(list.map((p) => p.comments)),
    avgCommentsPerThousand: mean(list.map((p) => p.commentsPerThousand)),
    avgImpressions: mean(list.map((p) => p.impressions)),
    avgReactions: mean(list.map((p) => p.reactions)),
    avgReposts: mean(list.map((p) => p.reposts)),
    totalImpressions: sum(list.map((p) => p.impressions)),
    posts: list,
  }));
  if (order) {
    rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  } else {
    rows.sort((a, b) => (b.avgEngagementRate ?? -1) - (a.avgEngagementRate ?? -1));
  }
  return rows;
}

function addTo(groups, key, p) {
  const k = key == null || key === '' ? 'Untagged' : key;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(p);
}

export function totals(posts) {
  const imp = sum(posts.map((p) => p.impressions));
  const reactions = sum(posts.map((p) => p.reactions));
  const comments = sum(posts.map((p) => p.comments));
  const reposts = sum(posts.map((p) => p.reposts));
  const engagements = posts.some((p) => p.reactions != null || p.comments != null || p.reposts != null)
    ? reactions + comments + reposts
    : sum(posts.map((p) => p.engagements));
  return {
    posts: posts.length,
    impressions: imp,
    reactions,
    comments,
    reposts,
    engagements,
    engagementRate: imp > 0 ? engagements / imp : null,
    avgEngagementRate: mean(posts.map((p) => p.engagementRate)),
    commentsPerThousand: imp > 0 ? (comments / imp) * 1000 : null,
  };
}

// Keep posts within the chosen window, measured back from the newest date in the data.
export function filterByRange(posts, days, anchorDate) {
  if (!days) return posts;
  const anchor = anchorDate || newestDate(posts);
  if (!anchor) return posts;
  const cutoff = new Date(anchor.getTime() - days * 86400000);
  return posts.filter((p) => p.date && p.date >= cutoff);
}

export function newestDate(items) {
  let newest = null;
  for (const it of items) {
    if (it.date && (!newest || it.date > newest)) newest = it.date;
  }
  return newest;
}

export function formatPercent(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return 'n/a';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return 'n/a';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
