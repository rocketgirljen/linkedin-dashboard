import { describe, it, expect } from 'vitest';
import { parseSheets, readSample, STANDARD_SHEETS } from './helpers.js';
import { parseXlsxBuffer, normalizeUrl, mergeExports } from '../src/lib/xlsxParser.js';
import { parseDate, excelSerialToDate } from '../src/lib/dates.js';

describe('parseWorkbook with a standard LinkedIn export', () => {
  const result = parseSheets(STANDARD_SHEETS);

  it('finds every sheet by name', () => {
    expect(result.missingSheets).toEqual([]);
    expect(Object.keys(result.foundSheets).sort()).toEqual(['demographics', 'discovery', 'engagement', 'followers', 'topPosts']);
  });

  it('reads discovery totals', () => {
    expect(result.discovery.impressions).toBe(12345);
    expect(result.discovery.membersReached).toBe(6789);
  });

  it('reads daily engagement rows in date order', () => {
    expect(result.engagement).toHaveLength(2);
    expect(result.engagement[0].impressions).toBe(300);
    expect(result.engagement[1].engagements).toBe(20);
    expect(result.engagement[0].date.getMonth()).toBe(6);
  });

  it('merges the side-by-side Top Posts tables by URL', () => {
    expect(result.posts).toHaveLength(2);
    const p111 = result.posts.find((p) => p.url.includes('111'));
    expect(p111.engagements).toBe(50);
    expect(p111.impressions).toBe(2000);
    expect(p111.date.getDate()).toBe(1);
    expect(result.hasPerPostBreakdown).toBe(false);
    expect(result.notes.some((n) => n.includes('not reactions, comments, and reposts'))).toBe(true);
  });

  it('reads followers', () => {
    expect(result.followers.map((f) => f.newFollowers)).toEqual([3, 5]);
    expect(result.followers[1].cumulativeNew).toBe(8);
  });

  it('groups demographics and converts fractions to percentages', () => {
    expect(result.demographics.seniority[0]).toEqual({ label: 'Senior', percentage: 40 });
    expect(result.demographics.jobFunction[0].label).toBe('Engineering');
    expect(result.demographics.industry[0].percentage).toBeCloseTo(30);
  });
});

describe('parseWorkbook with missing or renamed sheets', () => {
  it('reports missing sheets instead of throwing', () => {
    const { DEMOGRAPHICS, FOLLOWERS, ...rest } = STANDARD_SHEETS;
    const result = parseSheets(rest);
    expect(result.missingSheets).toEqual(['Followers', 'Demographics']);
    expect(result.followers).toBeNull();
    expect(result.demographics).toBeNull();
    expect(result.posts).toHaveLength(2);
  });

  it('detects a renamed sheet from its headers', () => {
    const result = parseSheets({
      Overview: STANDARD_SHEETS.DISCOVERY,
      Content: STANDARD_SHEETS['TOP POSTS'],
      Daily: STANDARD_SHEETS.ENGAGEMENT,
    });
    expect(result.posts).toHaveLength(2);
    expect(result.engagement).toHaveLength(2);
    expect(result.missingSheets).toEqual(['Followers', 'Demographics']);
    expect(result.notes.some((n) => n.includes('"Content" as Top Posts'))).toBe(true);
  });

  it('handles a workbook with no recognizable sheets', () => {
    const result = parseSheets({ Sheet1: [['a', 'b'], [1, 2]] });
    expect(result.missingSheets).toHaveLength(5);
    expect(result.posts).toEqual([]);
  });

  it('handles a Top Posts sheet with extra per-post columns', () => {
    const result = parseSheets({
      Posts: [
        ['Post URL', 'Post publish date', 'Impressions', 'Reactions', 'Comments', 'Reposts', 'Engagement rate'],
        ['https://www.linkedin.com/posts/abc', '2026-07-03', 1000, 30, 10, 5, '4.5%'],
      ],
    });
    expect(result.hasPerPostBreakdown).toBe(true);
    expect(result.posts[0].reactions).toBe(30);
    expect(result.posts[0].comments).toBe(10);
    expect(result.posts[0].engagements).toBeUndefined();
  });
});

describe('sample export files', () => {
  it('loads the full sample with every section present', () => {
    const result = parseXlsxBuffer(new Uint8Array(readSample('linkedin-sample-export.xlsx')));
    expect(result.missingSheets).toEqual([]);
    expect(result.posts.length).toBeGreaterThan(40);
    expect(result.hasPerPostBreakdown).toBe(true);
    expect(result.posts.every((p) => p.date && p.impressions > 0)).toBe(true);
    expect(result.demographics.seniority.length).toBeGreaterThan(3);
  });

  it('loads the renamed-sheets sample and reports what is missing', () => {
    const result = parseXlsxBuffer(new Uint8Array(readSample('linkedin-sample-export-renamed-sheets.xlsx')));
    expect(result.missingSheets).toEqual(['Engagement', 'Demographics']);
    expect(result.posts.length).toBeGreaterThan(40);
    expect(result.followers.length).toBeGreaterThan(100);
  });
});

describe('helpers', () => {
  it('normalizes URLs for matching', () => {
    expect(normalizeUrl('https://www.linkedin.com/feed/update/urn:li:activity:1/?utm=x')).toBe('linkedin.com/feed/update/urn:li:activity:1');
    expect(normalizeUrl('http://linkedin.com/feed/update/urn:li:activity:1')).toBe('linkedin.com/feed/update/urn:li:activity:1');
  });

  it('parses the date formats LinkedIn and Notion use', () => {
    expect(parseDate('7/12/2025').getMonth()).toBe(6);
    expect(parseDate('July 12, 2025 9:00 AM').getHours()).toBe(9);
    expect(parseDate('July 12, 2025 1:30 PM').getHours()).toBe(13);
    expect(parseDate('2025-07-12').getDate()).toBe(12);
    expect(parseDate('12 July 2025').getFullYear()).toBe(2025);
    expect(parseDate('nonsense')).toBeNull();
    expect(excelSerialToDate(45850).getFullYear()).toBe(2025);
  });
});

describe('mergeExports', () => {
  it('combines two exports and removes duplicate posts', () => {
    const a = parseSheets(STANDARD_SHEETS);
    const b = parseSheets({
      ...STANDARD_SHEETS,
      'TOP POSTS': [
        ['Post URL', 'Post publish date', 'Engagements', null, 'Post URL', 'Post publish date', 'Impressions'],
        ['https://www.linkedin.com/feed/update/urn:li:activity:222/', '7/2/2026', 40, null, 'https://www.linkedin.com/feed/update/urn:li:activity:333/', '7/3/2026', 9000],
        ['https://www.linkedin.com/feed/update/urn:li:activity:333/', '7/3/2026', 70, null, 'https://www.linkedin.com/feed/update/urn:li:activity:222/', '7/2/2026', 4000],
      ],
      ENGAGEMENT: [['Date', 'Impressions', 'Engagements'], ['7/2/2026', 450, 20], ['7/3/2026', 600, 25]],
    });
    const m = mergeExports([a, b]);
    expect(m.posts.map((p) => p.url.match(/\d+/)[0]).sort()).toEqual(['111', '222', '333']);
    expect(m.engagement).toHaveLength(3);
    expect(m.missingSheets).toEqual([]);
    expect(m.notes.some((n) => n.includes('2 exports were combined'))).toBe(true);
    expect(m.fileCount).toBe(2);
  });

  it('returns a single export unchanged', () => {
    const a = parseSheets(STANDARD_SHEETS);
    expect(mergeExports([a])).toBe(a);
  });
});
