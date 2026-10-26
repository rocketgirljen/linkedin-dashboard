// Reads a LinkedIn creator analytics export (.xlsx).
// Sheets are found by name and by header text, never by fixed position,
// because LinkedIn changes the layout from time to time.
import * as XLSX from 'xlsx';
import { parseDate, hasTimeComponent } from './dates.js';

// What we look for, in priority order. Each entry lists name hints and
// header keywords that identify the sheet when the name does not match.
// headerGroups: every group must be satisfied by at least one header cell.
// headerExclude: if any header cell contains one of these, the sheet is not a match.
const SHEET_SPECS = {
  topPosts: {
    nameHints: ['top posts', 'top_posts', 'posts'],
    headerGroups: [['post url', 'post link', 'url', 'link']],
    headerExclude: [],
  },
  engagement: {
    nameHints: ['engagement'],
    headerGroups: [['date'], ['impressions'], ['engagements']],
    headerExclude: ['url', 'link'],
  },
  followers: {
    nameHints: ['followers', 'follower'],
    headerGroups: [['date'], ['new followers', 'followers']],
    headerExclude: ['url', 'link', 'impressions'],
  },
  demographics: {
    nameHints: ['demographics'],
    headerGroups: [['percentage', 'percent'], ['value', 'top demographics']],
    headerExclude: ['url', 'link'],
  },
  discovery: {
    nameHints: ['discovery', 'overall performance', 'overview'],
    headerGroups: [['members reached', 'impressions']],
    headerExclude: ['url', 'link', 'date'],
    labelTable: true,
  },
};

const SHEET_LABELS = {
  discovery: 'Discovery',
  engagement: 'Engagement',
  topPosts: 'Top Posts',
  followers: 'Followers',
  demographics: 'Demographics',
};

export function normalizeHeader(text) {
  return String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function sheetToRows(sheet) {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: false });
}

// Find the first row that looks like a header: at least two text cells and at
// least one of the hints present. Returns the row index or -1.
export function findHeaderRow(rows, hints, maxScan = 12) {
  const limit = Math.min(rows.length, maxScan);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] || [];
    const cells = row.map(normalizeHeader).filter(Boolean);
    const textCells = row.filter((c) => typeof c === 'string' && c.trim());
    if (textCells.length < 2) continue;
    const hit = hints.some((h) => cells.some((c) => c.includes(h)));
    if (hit) return i;
  }
  return -1;
}

function pickSheet(workbook, key, used) {
  const spec = SHEET_SPECS[key];
  const names = workbook.SheetNames.filter((n) => !used.has(n));
  // 1. by name
  for (const hint of spec.nameHints) {
    const match = names.find((n) => normalizeHeader(n).includes(hint));
    if (match) return match;
  }
  // 2. by header text
  for (const name of names) {
    const rows = sheetToRows(workbook.Sheets[name]);
    if (spec.labelTable) {
      // Discovery is a label/value table with no header row, so scan the
      // first column for the labels instead.
      const labels = rows.slice(0, 12).flatMap((r) => (r || []).map(normalizeHeader));
      const hit = spec.headerGroups.every((g) => g.some((h) => labels.some((c) => c.includes(h))));
      const bad = spec.headerExclude.some((h) => labels.some((c) => c.includes(h)));
      if (hit && !bad) return name;
      continue;
    }
    const firstGroup = spec.headerGroups[0];
    const headerIdx = findHeaderRow(rows, firstGroup);
    if (headerIdx < 0) continue;
    const cells = (rows[headerIdx] || []).map(normalizeHeader).filter(Boolean);
    const allHit = spec.headerGroups.every((g) => g.some((h) => cells.some((c) => c.includes(h))));
    const excluded = spec.headerExclude.some((h) => cells.some((c) => c.includes(h)));
    if (allHit && !excluded) return name;
  }
  return null;
}

// Column lookup helpers -------------------------------------------------------

const COLUMN_ALIASES = {
  url: ['post url', 'post link', 'url', 'link'],
  date: ['post publish date', 'publish date', 'published', 'date', 'created'],
  impressions: ['impressions'],
  membersReached: ['members reached', 'unique views', 'reach'],
  engagements: ['engagements', 'engagement'],
  reactions: ['reactions', 'likes'],
  comments: ['comments'],
  reposts: ['reposts', 'shares'],
  saves: ['saves'],
  engagementRate: ['engagement rate'],
  text: ['post text', 'text', 'title', 'content'],
  newFollowers: ['new followers', 'followers gained'],
  totalFollowers: ['total followers', 'followers total'],
  category: ['top demographics', 'demographic', 'category'],
  value: ['value', 'name'],
  percentage: ['percentage', 'percent', '%', 'share'],
};

function matchColumn(headerCells, aliases, skip = new Set()) {
  for (const alias of aliases) {
    const idx = headerCells.findIndex((c, i) => !skip.has(i) && c && (c === alias || c.includes(alias)));
    if (idx >= 0) return idx;
  }
  return -1;
}

function toNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[,%\s]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function normalizeUrl(url) {
  if (!url) return '';
  let text = String(url).trim();
  if (!text) return '';
  text = text.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  text = text.split('?')[0].split('#')[0];
  text = text.replace(/\/+$/, '');
  return text.toLowerCase();
}

// Sheet parsers --------------------------------------------------------------

function parseDiscovery(rows) {
  // Discovery is a small label/value table: "Impressions", 1234 / "Members reached", 456
  const totals = {};
  for (const row of rows) {
    if (!row) continue;
    for (let i = 0; i < row.length - 1; i++) {
      const label = normalizeHeader(row[i]);
      const value = toNumber(row[i + 1]);
      if (!label || value == null) continue;
      if (label.includes('members reached') || label.includes('reach')) totals.membersReached = value;
      else if (label.includes('impression')) totals.impressions = value;
      else if (label.includes('engagement')) totals.engagements = value;
    }
  }
  return totals;
}

function parseEngagement(rows) {
  const headerIdx = findHeaderRow(rows, ['date']);
  if (headerIdx < 0) return [];
  const header = rows[headerIdx].map(normalizeHeader);
  const dateCol = matchColumn(header, COLUMN_ALIASES.date);
  const impCol = matchColumn(header, COLUMN_ALIASES.impressions);
  const engCol = matchColumn(header, COLUMN_ALIASES.engagements);
  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const date = parseDate(row[dateCol]);
    if (!date) continue;
    out.push({
      date,
      impressions: impCol >= 0 ? toNumber(row[impCol]) ?? 0 : 0,
      engagements: engCol >= 0 ? toNumber(row[engCol]) ?? 0 : 0,
    });
  }
  out.sort((a, b) => a.date - b.date);
  return out;
}

// Splits a header row into side-by-side tables. LinkedIn's Top Posts sheet puts
// "Post URL | Post publish date | Engagements" next to
// "Post URL | Post publish date | Impressions". Each table starts at a URL column.
function splitTables(header) {
  const tables = [];
  let current = null;
  header.forEach((cell, idx) => {
    const isUrl = COLUMN_ALIASES.url.some((a) => cell && cell.includes(a));
    if (isUrl) {
      current = { start: idx, columns: [idx] };
      tables.push(current);
    } else if (current && cell) {
      current.columns.push(idx);
    }
  });
  return tables;
}

function parseTopPosts(rows) {
  const headerIdx = findHeaderRow(rows, COLUMN_ALIASES.url);
  if (headerIdx < 0) return { posts: [], hasPerPostBreakdown: false };
  const header = rows[headerIdx].map(normalizeHeader);
  const tables = splitTables(header);
  if (!tables.length) return { posts: [], hasPerPostBreakdown: false };

  const byUrl = new Map();
  let hasPerPostBreakdown = false;

  for (const table of tables) {
    const cols = table.columns;
    const sub = cols.map((c) => header[c]);
    const col = (aliases) => {
      const i = matchColumn(sub, aliases);
      return i >= 0 ? cols[i] : -1;
    };
    const urlCol = cols[0];
    const dateCol = col(COLUMN_ALIASES.date);
    const map = {
      impressions: col(COLUMN_ALIASES.impressions),
      membersReached: col(COLUMN_ALIASES.membersReached),
      engagements: col(COLUMN_ALIASES.engagements),
      reactions: col(COLUMN_ALIASES.reactions),
      comments: col(COLUMN_ALIASES.comments),
      reposts: col(COLUMN_ALIASES.reposts),
      saves: col(COLUMN_ALIASES.saves),
      text: col(COLUMN_ALIASES.text),
    };
    // "engagement rate" header would also match "engagement"; make sure we do
    // not read a rate column as a count.
    if (map.engagements >= 0 && header[map.engagements].includes('rate')) map.engagements = -1;
    if (map.reactions >= 0 || map.comments >= 0 || map.reposts >= 0) hasPerPostBreakdown = true;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const rawUrl = row[urlCol];
      if (!rawUrl || typeof rawUrl !== 'string' || !/linkedin\.com|^https?:/i.test(rawUrl)) continue;
      const key = normalizeUrl(rawUrl);
      const post = byUrl.get(key) || { url: String(rawUrl).trim(), urlKey: key, source: 'linkedin' };
      if (dateCol >= 0 && !post.date) {
        const d = parseDate(row[dateCol]);
        if (d) {
          post.date = d;
          post.hasTime = hasTimeComponent(row[dateCol]);
        }
      }
      for (const [field, c] of Object.entries(map)) {
        if (c < 0) continue;
        if (field === 'text') {
          if (row[c] && !post.text) post.text = String(row[c]).trim();
        } else {
          const n = toNumber(row[c]);
          if (n != null) post[field] = n;
        }
      }
      byUrl.set(key, post);
    }
  }

  const posts = [...byUrl.values()];
  posts.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  return { posts, hasPerPostBreakdown };
}

function parseFollowers(rows) {
  const headerIdx = findHeaderRow(rows, ['date']);
  if (headerIdx < 0) return [];
  const header = rows[headerIdx].map(normalizeHeader);
  const dateCol = matchColumn(header, COLUMN_ALIASES.date);
  const newCol = matchColumn(header, COLUMN_ALIASES.newFollowers);
  const totalCol = matchColumn(header, COLUMN_ALIASES.totalFollowers);
  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const date = parseDate(row[dateCol]);
    if (!date) continue;
    out.push({
      date,
      newFollowers: newCol >= 0 ? toNumber(row[newCol]) ?? 0 : 0,
      totalFollowers: totalCol >= 0 ? toNumber(row[totalCol]) : null,
    });
  }
  out.sort((a, b) => a.date - b.date);
  // Fill a running total when the sheet only gives daily gains.
  let running = 0;
  for (const r of out) {
    if (r.totalFollowers == null) {
      running += r.newFollowers;
      r.cumulativeNew = running;
    } else {
      running = r.totalFollowers;
      r.cumulativeNew = running;
    }
  }
  return out;
}

const DEMOGRAPHIC_GROUPS = {
  seniority: ['seniority', 'experience level'],
  jobFunction: ['job function', 'function'],
  industry: ['industry', 'industries'],
  jobTitle: ['job title', 'job titles', 'title'],
  location: ['location', 'locations'],
  companySize: ['company size'],
};

function parseDemographics(rows) {
  const headerIdx = findHeaderRow(rows, ['percentage', 'value', 'top demographics']);
  if (headerIdx < 0) return {};
  const header = rows[headerIdx].map(normalizeHeader);
  const catCol = matchColumn(header, COLUMN_ALIASES.category);
  const valCol = matchColumn(header, COLUMN_ALIASES.value, new Set([catCol]));
  const pctCol = matchColumn(header, COLUMN_ALIASES.percentage, new Set([catCol, valCol]));
  if (valCol < 0 || pctCol < 0) return {};

  const groups = {};
  let currentGroup = null;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const catText = catCol >= 0 ? normalizeHeader(row[catCol]) : '';
    if (catText) currentGroup = catText;
    const label = row[valCol];
    const pct = toNumber(row[pctCol]);
    if (!label || pct == null || !currentGroup) continue;
    const groupKey = Object.keys(DEMOGRAPHIC_GROUPS).find((k) => DEMOGRAPHIC_GROUPS[k].some((h) => currentGroup.includes(h))) || currentGroup;
    if (!groups[groupKey]) groups[groupKey] = [];
    // Percentages sometimes arrive as fractions (0.23) and sometimes as 23.
    groups[groupKey].push({ label: String(label).trim(), percentage: pct <= 1 ? pct * 100 : pct });
  }
  for (const list of Object.values(groups)) list.sort((a, b) => b.percentage - a.percentage);
  return groups;
}

// Main entry -----------------------------------------------------------------

export function parseWorkbook(workbook) {
  const used = new Set();
  const found = {};
  const missing = [];
  const notes = [];

  for (const key of ['discovery', 'engagement', 'topPosts', 'followers', 'demographics']) {
    const name = pickSheet(workbook, key, used);
    if (name) {
      used.add(name);
      found[key] = name;
      if (!SHEET_SPECS[key].nameHints.some((h) => normalizeHeader(name).includes(h))) {
        notes.push(`Used sheet "${name}" as ${SHEET_LABELS[key]} based on its column headers.`);
      }
    } else {
      missing.push(SHEET_LABELS[key]);
    }
  }

  const rowsOf = (key) => (found[key] ? sheetToRows(workbook.Sheets[found[key]]) : []);

  const topPosts = found.topPosts ? parseTopPosts(rowsOf('topPosts')) : { posts: [], hasPerPostBreakdown: false };
  if (found.topPosts && !topPosts.posts.length) {
    notes.push('The Top Posts sheet was found but no post rows could be read from it.');
  }
  if (found.topPosts && topPosts.posts.length && !topPosts.hasPerPostBreakdown) {
    notes.push('The export lists engagements per post but not reactions, comments, and reposts separately. Comment metrics will use your calendar numbers where you logged them.');
  }

  return {
    sheetNames: workbook.SheetNames,
    foundSheets: found,
    missingSheets: missing,
    notes,
    discovery: found.discovery ? parseDiscovery(rowsOf('discovery')) : null,
    engagement: found.engagement ? parseEngagement(rowsOf('engagement')) : null,
    posts: topPosts.posts,
    hasPerPostBreakdown: topPosts.hasPerPostBreakdown,
    followers: found.followers ? parseFollowers(rowsOf('followers')) : null,
    demographics: found.demographics ? parseDemographics(rowsOf('demographics')) : null,
  };
}

// Combine several exports (each caps Top Posts at 50). Posts are de-duplicated
// by URL, and for each duplicate the entry with more data wins.
export function mergeExports(results) {
  if (!results.length) return null;
  if (results.length === 1) return results[0];
  const posts = new Map();
  const score = (p) => Object.values(p).filter((v) => v != null).length;
  for (const r of results) {
    for (const p of r.posts) {
      const existing = posts.get(p.urlKey);
      if (!existing) { posts.set(p.urlKey, { ...p }); continue; }
      // Keep the richer record and fill its gaps from the other one.
      const [keep, other] = score(p) > score(existing) ? [{ ...p }, existing] : [existing, p];
      for (const [k, v] of Object.entries(other)) if (keep[k] == null && v != null) keep[k] = v;
      posts.set(p.urlKey, keep);
    }
  }
  const byDate = (lists, key) => {
    const map = new Map();
    for (const list of lists) for (const row of list || []) {
      const k = row.date.toDateString();
      const prev = map.get(k);
      if (!prev || (row[key] || 0) > (prev[key] || 0)) map.set(k, row);
    }
    return [...map.values()].sort((a, b) => a.date - b.date);
  };
  const engagement = results.some((r) => r.engagement) ? byDate(results.map((r) => r.engagement), 'impressions') : null;
  let followers = results.some((r) => r.followers) ? byDate(results.map((r) => r.followers), 'newFollowers') : null;
  if (followers) {
    let running = 0;
    for (const f of followers) { running = f.totalFollowers != null ? f.totalFollowers : running + (f.newFollowers || 0); f.cumulativeNew = running; }
  }
  const withDemo = results.filter((r) => r.demographics && Object.keys(r.demographics).length);
  const withDisc = results.filter((r) => r.discovery && r.discovery.impressions != null).sort((a, b) => b.discovery.impressions - a.discovery.impressions);
  const allLabels = ['Discovery', 'Engagement', 'Top Posts', 'Followers', 'Demographics'];
  const missing = allLabels.filter((l) => results.every((r) => r.missingSheets.includes(l)));
  const notes = [...new Set(results.flatMap((r) => r.notes))];
  const list = [...posts.values()].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  const totalIn = results.reduce((a, r) => a + r.posts.length, 0);
  if (totalIn > list.length) notes.push(`${results.length} exports were combined: ${totalIn} post rows became ${list.length} unique posts.`);
  return {
    sheetNames: [...new Set(results.flatMap((r) => r.sheetNames))],
    foundSheets: Object.assign({}, ...results.map((r) => r.foundSheets)),
    missingSheets: missing,
    notes,
    discovery: withDisc[0]?.discovery || results.find((r) => r.discovery)?.discovery || null,
    engagement,
    posts: list,
    hasPerPostBreakdown: results.some((r) => r.hasPerPostBreakdown),
    followers,
    demographics: withDemo[withDemo.length - 1]?.demographics || null,
    fileCount: results.length,
  };
}

export function parseXlsxBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return parseWorkbook(workbook);
}

export async function parseXlsxFile(file) {
  const buffer = await file.arrayBuffer();
  return parseXlsxBuffer(new Uint8Array(buffer));
}
