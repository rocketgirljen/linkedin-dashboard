// Turns the numbers into three to five plain sentences.
// Rule: never declare a winner from fewer than MIN_GROUP_SIZE posts.
import { MIN_GROUP_SIZE, HOOK_LIMIT, DAYS_OF_WEEK } from './constants.js';
import { groupStats, formatPercent, formatNumber, totals } from './metrics.js';

function eligible(rows, metric) {
  return rows.filter((r) => r.key !== 'Untagged' && r.key !== 'Unknown' && r.count >= MIN_GROUP_SIZE && r[metric] != null);
}

function ratioPhrase(a, b) {
  if (b === 0) return null;
  const ratio = a / b;
  if (ratio >= 1.9) return `${ratio.toFixed(1).replace(/\.0$/, '')} times`;
  if (ratio >= 1.15) return `${Math.round((ratio - 1) * 100)}% more`;
  return null;
}

function compareGroups(rows, metric, label, unit, rangeLabel) {
  const list = eligible(rows, metric).sort((a, b) => b[metric] - a[metric]);
  if (list.length < 2) return null;
  const best = list[0];
  const worst = list[list.length - 1];
  const phrase = ratioPhrase(best[metric], worst[metric]);
  if (!phrase) {
    return `${label} groups performed about the same on ${unit} ${rangeLabel}. No clear winner yet.`;
  }
  const noun = label === 'Hook opener' ? 'openers' : 'posts';
  if (phrase.endsWith('times')) {
    return `${best.key} ${noun} earned ${phrase} the ${unit} of ${worst.key} ${noun} ${rangeLabel} (${best.count} vs ${worst.count} posts).`;
  }
  return `${best.key} ${noun} earned ${phrase} ${unit} than ${worst.key} ${noun} ${rangeLabel} (${best.count} vs ${worst.count} posts).`;
}

export function generateTakeaways(posts, { rangeLabel = 'in this period' } = {}) {
  const out = [];
  const tagged = posts.filter((p) => p.postType);
  const personaTagged = posts.filter((p) => p.persona);

  if (!posts.length) {
    return ['No posts in this date range yet. Load a LinkedIn export or widen the range.'];
  }

  // 1. Post type
  const typeRows = groupStats(tagged, 'postType');
  const hasComments = posts.some((p) => p.comments != null);
  const typeMetric = hasComments ? 'avgCommentsPerThousand' : 'avgEngagementRate';
  const typeUnit = hasComments ? 'comments per 1,000 impressions' : 'engagement rate';
  if (eligible(typeRows, typeMetric).length >= 2) {
    out.push(compareGroups(typeRows, typeMetric, 'Post type', typeUnit, rangeLabel));
  } else if (tagged.length < posts.length) {
    const untagged = posts.length - tagged.length;
    out.push(`Not enough data yet to compare post types: ${untagged} of ${posts.length} posts still need a Post Type tag, and each type needs at least ${MIN_GROUP_SIZE} posts.`);
  } else {
    out.push(`Not enough data yet to compare post types. Each type needs at least ${MIN_GROUP_SIZE} posts.`);
  }

  // 2. Persona
  const personaRows = groupStats(personaTagged, 'persona');
  if (eligible(personaRows, 'avgEngagementRate').length >= 2) {
    out.push(compareGroups(personaRows, 'avgEngagementRate', 'Persona', 'engagement rate', rangeLabel));
  } else {
    out.push(`Not enough data yet to compare personas. Each persona needs at least ${MIN_GROUP_SIZE} tagged posts.`);
  }

  // 3. Hook length
  const withHooks = posts.filter((p) => p.hook && p.engagementRate != null);
  const under = withHooks.filter((p) => !p.hookOverLimit);
  const over = withHooks.filter((p) => p.hookOverLimit);
  if (under.length >= MIN_GROUP_SIZE && over.length >= MIN_GROUP_SIZE) {
    const avg = (list) => list.reduce((a, p) => a + p.engagementRate, 0) / list.length;
    const u = avg(under);
    const o = avg(over);
    if (Math.abs(u - o) / Math.max(u, o) < 0.1) {
      out.push(`Hook length did not change results: hooks under ${HOOK_LIMIT} characters and longer hooks both averaged about ${formatPercent(u)} engagement.`);
    } else if (u > o) {
      out.push(`Hooks under ${HOOK_LIMIT} characters averaged ${formatPercent(u)} engagement versus ${formatPercent(o)} for longer hooks (${under.length} vs ${over.length} posts). Keep them short.`);
    } else {
      out.push(`Longer hooks averaged ${formatPercent(o)} engagement versus ${formatPercent(u)} for hooks under ${HOOK_LIMIT} characters (${over.length} vs ${under.length} posts). Worth watching.`);
    }
  } else if (over.length > 0) {
    out.push(`${over.length} ${over.length === 1 ? 'post' : 'posts'} ran past the ${HOOK_LIMIT}-character hook limit. Not enough data yet to say whether that hurt.`);
  }

  // 4. Hook opener
  const openerRows = groupStats(withHooks, 'hookOpener');
  const openerSentence = compareGroups(openerRows, 'avgEngagementRate', 'Hook opener', 'engagement rate', rangeLabel);
  if (openerSentence && !openerSentence.startsWith('Hook opener groups performed about the same')) {
    out.push(openerSentence);
  }

  // 5. Day of week
  const dayRows = groupStats(posts.filter((p) => p.dayOfWeek), 'dayOfWeek', { order: DAYS_OF_WEEK });
  const dayList = eligible(dayRows, 'avgEngagementRate').sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);
  if (dayList.length >= 2) {
    const best = dayList[0];
    const phrase = ratioPhrase(best.avgEngagementRate, dayList[dayList.length - 1].avgEngagementRate);
    if (phrase) {
      out.push(`${best.key} posts averaged the highest engagement rate (${formatPercent(best.avgEngagementRate)} across ${best.count} posts). ${dayList[dayList.length - 1].key} was lowest.`);
    }
  }

  // Always give at least three sentences: fill with the plain facts.
  if (out.length < 3) {
    const t = totals(posts);
    out.push(`${posts.length} ${posts.length === 1 ? 'post' : 'posts'} ${rangeLabel} reached ${formatNumber(t.impressions)} impressions with a ${formatPercent(t.engagementRate)} engagement rate overall.`);
  }
  if (out.length < 3) {
    const best = posts.filter((p) => p.engagementRate != null).sort((a, b) => b.engagementRate - a.engagementRate)[0];
    if (best) {
      const label = best.hook ? `"${best.hook.length > 60 ? best.hook.slice(0, 57) + '...' : best.hook}"` : 'Your top post';
      out.push(`${label} was the best post by engagement rate at ${formatPercent(best.engagementRate)}.`);
    }
  }

  return out.slice(0, 5);
}
