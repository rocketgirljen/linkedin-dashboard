// Reads the Notion "Content Calendar" CSV export.
import Papa from 'papaparse';
import { parseDate, hasTimeComponent } from './dates.js';
import { normalizeUrl, normalizeHeader } from './xlsxParser.js';
import { POST_TYPES, PERSONAS } from './constants.js';

const COLUMNS = {
  name: ['name', 'title', 'hook'],
  date: ['publication date', 'publish date', 'published', 'date'],
  url: ['live post link', 'post link', 'post url', 'url', 'link'],
  platform: ['platform'],
  status: ['status'],
  contentType: ['content type', 'format'],
  funnel: ['funnel', 'funnel stage'],
  pillars: ['content pillars', 'content pillar', 'pillars', 'pillar', 'theme'],
  impressions: ['impressions'],
  reactions: ['reactions', 'likes'],
  comments: ['comments'],
  reposts: ['reposts', 'shares'],
  saves: ['saves'],
  newFollowers: ['new followers'],
  postType: ['post type'],
  persona: ['persona'],
};

function findColumn(headers, aliases) {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const exact = normalized.indexOf(alias);
    if (exact >= 0) return headers[exact];
  }
  for (const alias of aliases) {
    const idx = normalized.findIndex((h) => h.includes(alias));
    if (idx >= 0) return headers[idx];
  }
  return null;
}

// "Career Strategy (https://www.notion.so/abc123), Visibility (https://...)"
// becomes ["Career Strategy", "Visibility"].
export function stripNotionLinks(text) {
  if (!text) return [];
  // Notion exports relations as "Name (https://app.notion.com/p/...)" or
  // "Name (https://www.notion.so/...)". Remove any URL in parentheses, then
  // any bare URL that is left.
  const withoutLinks = String(text)
    .replace(/\s*\(\s*(?:https?:\/\/|www\.)[^)]*\)/gi, '')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, '');
  return withoutLinks
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function num(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[,%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Match a free-text tag against the fixed list, forgiving case and spacing.
export function matchFixedValue(value, list) {
  if (!value) return null;
  const key = String(value).trim().toLowerCase().replace(/[^a-z]/g, '');
  const hit = list.find((item) => item.toLowerCase().replace(/[^a-z]/g, '') === key);
  return hit || null;
}

export function parseCalendarText(csvText) {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: 'greedy' });
  const headers = result.meta.fields || [];
  return parseCalendarRows(result.data, headers);
}

export function parseCalendarRows(rows, headers) {
  const col = {};
  for (const [key, aliases] of Object.entries(COLUMNS)) col[key] = findColumn(headers, aliases);

  const warnings = [];
  if (!col.name) warnings.push('The calendar has no Name column, so hooks cannot be read.');
  if (!col.url && !col.date) warnings.push('The calendar has neither a Live Post Link nor a Publication Date column, so posts cannot be matched.');

  const hasPostTypeColumn = Boolean(col.postType);
  const hasPersonaColumn = Boolean(col.persona);

  const posts = [];
  let skippedPlatform = 0;
  let skippedStatus = 0;

  for (const row of rows) {
    const get = (key) => (col[key] ? row[col[key]] : undefined);
    const platform = String(get('platform') ?? '').toLowerCase();
    const status = String(get('status') ?? '').toLowerCase();
    if (col.platform && !platform.includes('linkedin')) { skippedPlatform++; continue; }
    if (col.status && !status.includes('published')) { skippedStatus++; continue; }

    const rawDate = get('date');
    const date = parseDate(rawDate);
    const url = String(get('url') ?? '').trim();
    posts.push({
      source: 'calendar',
      name: String(get('name') ?? '').trim(),
      date,
      hasTime: hasTimeComponent(rawDate),
      url,
      urlKey: normalizeUrl(url),
      contentType: String(get('contentType') ?? '').trim() || null,
      funnel: String(get('funnel') ?? '').trim() || null,
      pillars: stripNotionLinks(get('pillars')),
      manual: {
        impressions: num(get('impressions')),
        reactions: num(get('reactions')),
        comments: num(get('comments')),
        reposts: num(get('reposts')),
        saves: num(get('saves')),
        newFollowers: num(get('newFollowers')),
      },
      postType: matchFixedValue(get('postType'), POST_TYPES),
      persona: matchFixedValue(get('persona'), PERSONAS),
    });
  }

  return {
    posts,
    columns: col,
    hasPostTypeColumn,
    hasPersonaColumn,
    skippedPlatform,
    skippedStatus,
    warnings,
  };
}
