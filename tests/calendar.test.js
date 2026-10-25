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

  it('lists calendar rows that could not be matched', () => {
    expect(unmatchedCalendar).toHaveLength(1);
    expect(unmatchedCalendar[0].name).toBe('Orphan post');
    expect(unmatchedCalendar[0].matchProblem).toMatch(/No LinkedIn post/);
  });

  it('does not guess when two export posts share a date', () => {
    const twoSameDay = [
      { url: 'https://l/1', urlKey: 'l/1', date: new Date(2026, 6, 5) },
      { url: 'https://l/2', urlKey: 'l/2', date: new Date(2026, 6, 5) },
    ];
    const res = matchPosts(twoSameDay, [{ name: 'A', date: new Date(2026, 6, 5), urlKey: '', manual: {} }]);
    expect(res.unmatchedCalendar).toHaveLength(1);
    expect(res.unmatchedCalendar[0].matchProblem).toMatch(/Several LinkedIn posts/);
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
