import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCalendarText, stripNotionLinks } from '../src/lib/calendar.js';
import { matchPosts } from '../src/lib/matching.js';
import { parseSheets, STANDARD_SHEETS, readSample } from './helpers.js';
import { parseXlsxBuffer } from '../src/lib/xlsxParser.js';

const CSV = [
  'Name,Publication Date,Live Post Link,Platform,Status,Content Type,Funnel,Content Pillars,Impressions,Comments,Notes',
  'Why nobody promotes the fixer,"July 1, 2026 8:15 AM",https://www.linkedin.com/feed/update/urn:li:activity:111/?utm=share,LinkedIn,Published,Carousel,Awareness,"Visibility (https://www.notion.so/Visibility-1a2b), Scope Control (https://www.notion.so/Scope-2b3c)",,7,x',
  'I said yes to everything,"July 2, 2026 9:00 AM",,LinkedIn,Published,Text Only,Nurture,Visibility (https://www.notion.so/Visibility-1a2b),5000,3,',
  'Orphan post,"July 9, 2026 9:00 AM",,LinkedIn,Published,Poll,Conversion,,,,',
  'Newsletter issue,"July 1, 2026",,Newsletter,Published,Text Only,Nurture,,,,',
  'Still a draft,"July 3, 2026",,LinkedIn,Draft,Text Only,Awareness,,,,',
].join('\n');

describe('calendar CSV parsing', () => {
  const cal = parseCalendarText(CSV);

  it('keeps only LinkedIn posts with Status Published', () => {
    expect(cal.posts).toHaveLength(3);
    expect(cal.skippedPlatform).toBe(1);
    expect(cal.skippedStatus).toBe(1);
  });

  it('strips Notion links from pillars', () => {
    expect(cal.posts[0].pillars).toEqual(['Visibility', 'Scope Control']);
    expect(stripNotionLinks('Solo (https://www.notion.so/x)')).toEqual(['Solo']);
    expect(stripNotionLinks('Visibility (https://app.notion.com/p/1a2b3c), Scope Control (https://app.notion.com/p/4d5e)')).toEqual(['Visibility', 'Scope Control']);
    expect(stripNotionLinks('Plain name')).toEqual(['Plain name']);
    expect(stripNotionLinks('')).toEqual([]);
  });

  it('reads the Notion date with its time', () => {
    expect(cal.posts[0].date.getHours()).toBe(8);
    expect(cal.posts[0].hasTime).toBe(true);
  });

  it('reads manual metrics and ignores unknown columns', () => {
    expect(cal.posts[1].manual.impressions).toBe(5000);
    expect(cal.posts[1].manual.comments).toBe(3);
    expect(cal.posts[0].manual.impressions).toBeNull();
  });

  it('reports no Post Type or Persona columns', () => {
    expect(cal.hasPostTypeColumn).toBe(false);
    expect(cal.hasPersonaColumn).toBe(false);
  });

  it('reads Post Type and Persona columns when present', () => {
    const withTags = parseCalendarText('Name,Publication Date,Live Post Link,Post Type,Persona\nHook,7/1/2026,https://x/1,myth busting,quiet fixer');
    expect(withTags.hasPostTypeColumn).toBe(true);
    expect(withTags.posts[0].postType).toBe('Myth-Busting');
    expect(withTags.posts[0].persona).toBe('Quiet Fixer');
  });
});

describe('matching calendar rows to export posts', () => {
  const li = parseSheets(STANDARD_SHEETS).posts;
  const cal = parseCalendarText(CSV);
  const { posts, unmatchedCalendar } = matchPosts(li, cal.posts);

  it('matches by URL first, ignoring query strings and trailing slashes', () => {
    const p = posts.find((x) => x.url.includes('111'));
    expect(p.matchMethod).toBe('url');
    expect(p.hook).toBe('Why nobody promotes the fixer');
    expect(p.contentType).toBe('Carousel');
  });

  it('falls back to the publication date when there is no link', () => {
    const p = posts.find((x) => x.url.includes('222'));
    expect(p.matchMethod).toBe('date');
    expect(p.hook).toBe('I said yes to everything');
    expect(p.funnel).toBe('Nurture');
  });

  it('prefers LinkedIn numbers and uses calendar numbers only for gaps', () => {
    const p = posts.find((x) => x.url.includes('222'));
    expect(p.impressions).toBe(4000);
    expect(p.metricSources.impressions).toBe('linkedin');
    expect(p.comments).toBe(3);
    expect(p.metricSources.comments).toBe('calendar');
  });

  it('uses the calendar time of day when the export has none', () => {
    const p = posts.find((x) => x.url.includes('111'));
    expect(p.hasTime).toBe(true);
    expect(p.date.getHours()).toBe(8);
  });

  it('keeps calendar rows that could not be matched as calendar-only posts', () => {
    expect(unmatchedCalendar).toHaveLength(1);
    expect(unmatchedCalendar[0].name).toBe('Orphan post');
    expect(unmatchedCalendar[0].matchProblem).toMatch(/No LinkedIn post/);
    expect(posts).toHaveLength(3);
    const orphan = posts.find((p) => p.hook === 'Orphan post');
    expect(orphan.source).toBe('calendar');
    expect(orphan.contentType).toBe('Poll');
    expect(orphan.urlKey).toMatch(/^calendar:2026-07-09:/);
  });

  it('uses Notion numbers for calendar-only posts', () => {
    const res = matchPosts([], [{ name: 'Solo', date: new Date(2026, 6, 9), url: 'https://www.linkedin.com/feed/update/urn:li:activity:9/', urlKey: 'linkedin.com/feed/update/urn:li:activity:9', manual: { impressions: 1200, reactions: 30, comments: 4, reposts: 1 } }]);
    const p = res.posts[0];
    expect(p.impressions).toBe(1200);
    expect(p.comments).toBe(4);
    expect(p.metricSources.impressions).toBe('calendar');
    expect(p.urlKey).toBe('linkedin.com/feed/update/urn:li:activity:9');
  });

  it('matches on the shared numeric post ID when URL formats differ', () => {
    const li = [{ url: 'https://www.linkedin.com/posts/jennifer-wright_scope-sponge-activity-7380000000000000001-AbCd', urlKey: 'linkedin.com/posts/jennifer-wright_scope-sponge-activity-7380000000000000001-abcd', date: new Date(2026, 6, 5) }];
    const res = matchPosts(li, [{ name: 'Scope sponge', date: new Date(2026, 6, 6), url: 'https://www.linkedin.com/feed/update/urn:li:activity:7380000000000000001/', urlKey: 'linkedin.com/feed/update/urn:li:activity:7380000000000000001', manual: {} }]);
    expect(res.posts[0].matchMethod).toBe('id');
    expect(res.unmatchedCalendar).toHaveLength(0);
  });

  it('uses the hook against the URL slug when two export posts share a date', () => {
    const day = new Date(2026, 6, 5);
    const li = [
      { url: 'https://www.linkedin.com/posts/jennifer-wright_hard-work-does-not-speak-for-itself-share-7380000000000000001-AbCd', urlKey: 'a', date: day },
      { url: 'https://www.linkedin.com/posts/jennifer-wright_three-questions-before-you-say-yes-share-7380000000000000002-EfGh', urlKey: 'b', date: day },
    ];
    const cal = [
      { name: '3 questions to ask before you say yes to more scope.', date: day, url: 'https://www.linkedin.com/feed/update/urn:li:activity:7380000000000000999/', urlKey: 'x', manual: {} },
      { name: 'Hard work does not speak for itself. It never did.', date: day, url: '', urlKey: '', manual: {} },
    ];
    const res = matchPosts(li, cal);
    expect(res.posts.find((p) => p.urlKey === 'b').hook).toMatch(/^3 questions/);
    expect(res.posts.find((p) => p.urlKey === 'a').hook).toMatch(/^Hard work/);
    expect(res.posts.find((p) => p.urlKey === 'b').matchMethod).toBe('hook');
    expect(res.unmatchedCalendar).toHaveLength(0);
  });

  it('keeps the row as calendar-only when several posts share a date and no slug fits', () => {
    const twoSameDay = [
      { url: 'https://www.linkedin.com/feed/update/urn:li:share:1/', urlKey: 'l/1', date: new Date(2026, 6, 5) },
      { url: 'https://www.linkedin.com/feed/update/urn:li:share:2/', urlKey: 'l/2', date: new Date(2026, 6, 5) },
    ];
    const res = matchPosts(twoSameDay, [{ name: 'A hook', date: new Date(2026, 6, 5), urlKey: '', manual: {} }]);
    expect(res.unmatchedCalendar).toHaveLength(1);
    expect(res.unmatchedCalendar[0].matchProblem).toMatch(/Several LinkedIn posts/);
    expect(res.posts).toHaveLength(3);
  });
});

describe('a 50-post export against a larger calendar', () => {
  // Mirrors the real situation: LinkedIn caps Top Posts at 50, the calendar
  // has 149 published posts, export links use share IDs and the calendar uses
  // activity IDs, so only dates and hooks can join them.
  const start = new Date(2026, 0, 5);
  const calendar = [];
  const exportPosts = [];
  for (let i = 0; i < 149; i++) {
    const date = new Date(start.getTime() + Math.floor(i / 2) * 86400000); // two posts most days
    const name = `Post number ${i} about ${['visibility', 'scope', 'promotion', 'feedback'][i % 4]} and ${['teams', 'managers', 'careers'][i % 3]}`;
    const activity = `7380000000000${String(100000 + i)}`;
    calendar.push({
      name,
      date,
      hasTime: false,
      url: `https://www.linkedin.com/feed/update/urn:li:activity:${activity}/`,
      urlKey: `linkedin.com/feed/update/urn:li:activity:${activity}`,
      contentType: 'Text Only',
      funnel: 'Awareness',
      pillars: ['Visibility'],
      manual: { impressions: 1000 + i, reactions: 10, comments: 2, reposts: 1 },
    });
    if (i >= 99) {
      // Only the newest 50 made it into the export, under share IDs with slugs.
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const url = `https://www.linkedin.com/posts/jennifer-wright_${slug}-share-7390000000000${String(100000 + i)}-AbCd`;
      exportPosts.push({ url, urlKey: url.replace(/^https:\/\/www\./, '').toLowerCase(), date, impressions: 5000 + i, engagements: 100 });
    }
  }

  it('includes every calendar post and matches the 50 exported ones', () => {
    const res = matchPosts(exportPosts, calendar.map((c) => ({ ...c })));
    expect(res.posts).toHaveLength(149);
    const hooks = new Set(res.posts.map((p) => p.hook));
    for (const c of calendar) expect(hooks.has(c.name)).toBe(true);
    const fromLinkedin = res.posts.filter((p) => p.source === 'linkedin');
    expect(fromLinkedin).toHaveLength(50);
    expect(fromLinkedin.every((p) => p.calendar)).toBe(true);
    expect(fromLinkedin.every((p) => p.metricSources.impressions === 'linkedin')).toBe(true);
    expect(res.unmatchedCalendar).toHaveLength(99);
    expect(res.posts.filter((p) => p.source === 'calendar').every((p) => p.metricSources.impressions === 'calendar')).toBe(true);
    expect(res.unmatchedLinkedin).toHaveLength(0);
  });
});

describe('sample calendar against sample export', () => {
  it('matches most rows and lists the rest', () => {
    const li = parseXlsxBuffer(new Uint8Array(readSample('linkedin-sample-export.xlsx')));
    const cal = parseCalendarText(readFileSync('public/sample/content-calendar-sample.csv', 'utf8'));
    const { posts, unmatchedCalendar } = matchPosts(li.posts, cal.posts);
    const matched = posts.filter((p) => p.calendar).length;
    expect(matched).toBeGreaterThan(li.posts.length * 0.9);
    expect(unmatchedCalendar.length).toBeGreaterThanOrEqual(1);
    expect(posts.every((p) => p.calendar == null || p.pillars.every((x) => !x.includes('notion.so')))).toBe(true);
  });
});
