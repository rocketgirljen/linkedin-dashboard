import { describe, it, expect } from 'vitest';
import { engagementRate, commentsPerThousand, enrichPost, groupStats, classifyHookOpener, filterByRange, totals } from '../src/lib/metrics.js';
import { generateTakeaways } from '../src/lib/takeaways.js';
import { applyTags, parseTagsJson, setTag, emptyTags, tagsToJson } from '../src/lib/tags.js';
import { MIN_GROUP_SIZE } from '../src/lib/constants.js';

describe('engagement rate matches a hand calculation', () => {
  // Hand calculations:
  // Post A: (120 + 30 + 10) / 4000 = 160 / 4000 = 0.04
  // Post B: (45 + 5 + 0) / 2500 = 50 / 2500 = 0.02
  // Post C: (9 + 1 + 2) / 800 = 12 / 800 = 0.015
  it('post A', () => {
    expect(engagementRate({ impressions: 4000, reactions: 120, comments: 30, reposts: 10 })).toBeCloseTo(0.04, 10);
  });
  it('post B', () => {
    expect(engagementRate({ impressions: 2500, reactions: 45, comments: 5, reposts: 0 })).toBeCloseTo(0.02, 10);
  });
  it('post C', () => {
    expect(engagementRate({ impressions: 800, reactions: 9, comments: 1, reposts: 2 })).toBeCloseTo(0.015, 10);
  });
  it('falls back to total engagements when there is no breakdown', () => {
    expect(engagementRate({ impressions: 1000, engagements: 25 })).toBeCloseTo(0.025);
  });
  it('returns null with no impressions', () => {
    expect(engagementRate({ impressions: 0, reactions: 5 })).toBeNull();
    expect(engagementRate({ reactions: 5 })).toBeNull();
  });
});

describe('comments per 1,000 impressions', () => {
  it('matches a hand calculation: 30 comments / 4000 impressions = 7.5 per 1,000', () => {
    expect(commentsPerThousand({ impressions: 4000, comments: 30 })).toBeCloseTo(7.5);
  });
  it('is null when comments are unknown', () => {
    expect(commentsPerThousand({ impressions: 4000 })).toBeNull();
  });
});

describe('hook analysis', () => {
  it('classifies openers', () => {
    expect(classifyHookOpener('Why does nobody promote the fixer?')).toBe('Question');
    expect(classifyHookOpener('3 questions to ask before saying yes')).toBe('Number');
    expect(classifyHookOpener('I turned down a promotion once.')).toBe('I statement');
    expect(classifyHookOpener('Hard work does not speak for itself.')).toBe('Contrarian');
    expect(classifyHookOpener('The quiet fixer problem, explained.')).toBe('Other');
  });
  it('flags hooks over 53 characters', () => {
    const short = enrichPost({ hook: 'Short hook', impressions: 100 });
    const long = enrichPost({ hook: 'This hook keeps going and going well past the fifty three character mark', impressions: 100 });
    expect(short.hookOverLimit).toBe(false);
    expect(long.hookOverLimit).toBe(true);
    expect(long.hookLength).toBeGreaterThan(53);
  });
  it('records day of week and time bucket', () => {
    const p = enrichPost({ hook: 'x', date: new Date(2026, 6, 7, 8, 30), hasTime: true });
    expect(p.dayOfWeek).toBe('Tuesday');
    expect(p.timeBucket).toBe('Morning (8-11)');
    expect(enrichPost({ hook: 'x', date: new Date(2026, 6, 7), hasTime: false }).timeBucket).toBe('Unknown');
  });
});

function mk(overrides) {
  return enrichPost({ hook: 'A hook', impressions: 1000, reactions: 20, comments: 5, reposts: 2, date: new Date(2026, 6, 7, 9), hasTime: true, ...overrides });
}

describe('group stats and totals', () => {
  it('averages per group with counts', () => {
    const posts = [
      mk({ postType: 'Framework', comments: 10 }),
      mk({ postType: 'Framework', comments: 20 }),
      mk({ postType: 'Launch', comments: 5 }),
    ];
    const rows = groupStats(posts, 'postType');
    const fw = rows.find((r) => r.key === 'Framework');
    expect(fw.count).toBe(2);
    expect(fw.avgComments).toBe(15);
    expect(rows.find((r) => r.key === 'Launch').count).toBe(1);
  });
  it('labels untagged posts', () => {
    expect(groupStats([mk({})], 'postType')[0].key).toBe('Untagged');
  });
  it('totals use pooled impressions', () => {
    const t = totals([mk({ impressions: 1000, reactions: 10, comments: 0, reposts: 0 }), mk({ impressions: 3000, reactions: 30, comments: 0, reposts: 0 })]);
    expect(t.impressions).toBe(4000);
    expect(t.engagementRate).toBeCloseTo(0.01);
  });
  it('filters by range from the newest date', () => {
    const posts = [mk({ date: new Date(2026, 0, 1) }), mk({ date: new Date(2026, 5, 1) }), mk({ date: new Date(2026, 5, 20) })];
    expect(filterByRange(posts, 30)).toHaveLength(2);
    expect(filterByRange(posts, 90)).toHaveLength(2);
    expect(filterByRange(posts, null)).toHaveLength(3);
  });
});

describe('takeaways', () => {
  it('never names a group with fewer than three posts', () => {
    const posts = [
      mk({ postType: 'Myth-Busting', persona: 'Quiet Fixer', comments: 50 }),
      mk({ postType: 'Myth-Busting', persona: 'Quiet Fixer', comments: 40 }),
      mk({ postType: 'Framework', persona: 'Scope Sponge', comments: 1 }),
      mk({ postType: 'Framework', persona: 'Scope Sponge', comments: 2 }),
    ];
    const text = generateTakeaways(posts).join(' ');
    expect(text).toMatch(/Not enough data yet/);
    expect(text).not.toMatch(/Myth-Busting posts earned/);
    expect(text).not.toMatch(/Framework posts earned/);
    expect(text).not.toMatch(/Quiet Fixer posts earned/);
  });

  it('names a winner once each group has at least three posts', () => {
    const posts = [];
    for (let i = 0; i < MIN_GROUP_SIZE; i++) {
      posts.push(mk({ postType: 'Myth-Busting', persona: 'Scope Sponge', comments: 40, reactions: 60, date: new Date(2026, 6, 7 + i, 9) }));
      posts.push(mk({ postType: 'Framework', persona: 'Quiet Fixer', comments: 10, reactions: 10, date: new Date(2026, 6, 7 + i, 9) }));
    }
    const text = generateTakeaways(posts);
    expect(text.length).toBeGreaterThanOrEqual(3);
    expect(text.length).toBeLessThanOrEqual(5);
    expect(text[0]).toMatch(/^Myth-Busting posts earned .* (than|of) Framework posts/);
    expect(text[1]).toMatch(/^Scope Sponge posts earned .* (than|of) Quiet Fixer posts/);
  });

  it('every cited group in the sentences has at least three posts', () => {
    const posts = [];
    const types = ['Myth-Busting', 'Framework', 'Launch'];
    types.forEach((t, ti) => {
      const n = ti === 2 ? 2 : 4; // Launch has only two posts
      for (let i = 0; i < n; i++) posts.push(mk({ postType: t, comments: ti === 2 ? 500 : 10 * (ti + 1), date: new Date(2026, 6, 1 + i + ti, 9) }));
    });
    const text = generateTakeaways(posts).join(' ');
    expect(text).not.toMatch(/Launch/);
  });

  it('says there are no posts when the range is empty', () => {
    expect(generateTakeaways([])[0]).toMatch(/No posts/);
  });
});

describe('tags', () => {
  it('round-trips through JSON keyed by URL', () => {
    const posts = [{ url: 'https://www.linkedin.com/feed/update/urn:li:activity:1/', urlKey: 'linkedin.com/feed/update/urn:li:activity:1' }];
    let tags = setTag(emptyTags(), posts[0].urlKey, 'postType', 'Launch');
    tags = setTag(tags, posts[0].urlKey, 'persona', 'Quiet Fixer');
    const json = tagsToJson(tags, posts);
    expect(json).toContain('https://www.linkedin.com/feed/update/urn:li:activity:1/');
    const back = parseTagsJson(json);
    expect(applyTags(posts, back)[0].postType).toBe('Launch');
    expect(applyTags(posts, back)[0].persona).toBe('Quiet Fixer');
  });
  it('ignores values outside the fixed lists', () => {
    const back = parseTagsJson(JSON.stringify({ posts: { 'https://x/1': { postType: 'Rant', persona: 'Quiet Fixer' } } }));
    expect(back.posts['x/1']).toEqual({ persona: 'Quiet Fixer' });
  });
  it('falls back to calendar tags when no manual tag exists', () => {
    const posts = [{ urlKey: 'a', initialPostType: 'Framework', initialPersona: null }];
    expect(applyTags(posts, emptyTags())[0].postType).toBe('Framework');
  });
});
