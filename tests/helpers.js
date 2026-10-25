import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseWorkbook } from '../src/lib/xlsxParser.js';

export function workbookFromSheets(sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  // Round-trip through a buffer so cell types behave like a real file.
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return XLSX.read(buf, { type: 'array', cellDates: true });
}

export function parseSheets(sheets) {
  return parseWorkbook(workbookFromSheets(sheets));
}

export function readSample(name) {
  return readFileSync(join(process.cwd(), 'public', 'sample', name));
}

export const STANDARD_SHEETS = {
  DISCOVERY: [
    ['Overall Performance', '7/1/2026 - 9/30/2026'],
    ['Impressions', 12345],
    ['Members reached', 6789],
  ],
  ENGAGEMENT: [
    ['Date', 'Impressions', 'Engagements'],
    ['7/1/2026', 300, 12],
    ['7/2/2026', 450, 20],
  ],
  'TOP POSTS': [
    ['Top posts by engagements', null, null, null, 'Top posts by impressions', null, null],
    ['Post URL', 'Post publish date', 'Engagements', null, 'Post URL', 'Post publish date', 'Impressions'],
    ['https://www.linkedin.com/feed/update/urn:li:activity:111/', '7/1/2026', 50, null, 'https://www.linkedin.com/feed/update/urn:li:activity:222/', '7/2/2026', 4000],
    ['https://www.linkedin.com/feed/update/urn:li:activity:222/', '7/2/2026', 40, null, 'https://www.linkedin.com/feed/update/urn:li:activity:111/', '7/1/2026', 2000],
  ],
  FOLLOWERS: [
    ['Date', 'New followers'],
    ['7/1/2026', 3],
    ['7/2/2026', 5],
  ],
  DEMOGRAPHICS: [
    ['Top Demographics', 'Value', 'Percentage'],
    ['Seniority', 'Senior', 0.4],
    [null, 'Entry', 0.2],
    ['Job function', 'Engineering', 0.5],
    ['Industries', 'Software Development', 0.3],
  ],
};
