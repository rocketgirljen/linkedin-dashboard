// Generates synthetic sample files for demos and tests.
// Nothing here is real data. Run with: npm run sample
import * as XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'sample');
mkdirSync(outDir, { recursive: true });

// Small seeded random generator so the files are the same every run.
let seed = 20251024;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (lo, hi) => Math.round(lo + rand() * (hi - lo));

const POST_TYPES = ['Personal Story', 'Pattern Naming', 'System Reframe', 'Myth-Busting', 'Framework', 'Launch'];
const PERSONAS = ['Overlooked Expert', 'Scope Sponge', 'Quiet Fixer'];
const CONTENT_TYPES = ['Text Only', 'Carousel', 'Infographic', 'Poll', 'Quote', 'Video'];
const FUNNEL = ['Awareness', 'Consideration', 'Conversion', 'Nurture'];
const PILLARS = [
  ['Visibility', 'https://www.notion.so/Visibility-1a2b3c4d5e6f7081'],
  ['Scope Control', 'https://www.notion.so/Scope-Control-2b3c4d5e6f708192'],
  ['Career Strategy', 'https://www.notion.so/Career-Strategy-3c4d5e6f70819203'],
  ['Leadership Voice', 'https://www.notion.so/Leadership-Voice-4d5e6f7081920314'],
];

// Hooks by post type. Lengths vary so some run past 53 characters.
const HOOKS = {
  'Personal Story': [
    'I turned down a promotion once. Here is what it taught me.',
    'I spent 6 years being the fixer nobody promoted.',
    'My manager forgot my name in a room I had built.',
    'I almost quit engineering in 2019.',
    'I said yes to every project for a decade.',
    'I rewrote my resume 14 times before I saw the problem.',
  ],
  'Pattern Naming': [
    'There is a name for doing everyone else\'s work: scope sponge.',
    'The quiet fixer problem, explained in one sentence.',
    'Overlooked experts share one habit. It is not modesty.',
    'The invisible glue work tax has a pattern.',
    'Why the most reliable engineer is the least promoted.',
    'Three signs you have become the team\'s scope sponge.',
  ],
  'System Reframe': [
    'Promotion is not a reward. It is a staffing decision.',
    'Your performance review measures visibility, not value.',
    'Stop treating feedback as a verdict.',
    'Being essential is a trap, not a career strategy.',
    'The ladder was never the only shape a career can take.',
    'Visibility is a system problem, not a personality flaw.',
  ],
  'Myth-Busting': [
    'Hard work does not speak for itself. It never did.',
    'Nobody is coming to notice your work. That is not cynicism.',
    'Most career advice for women in STEM is wrong about one thing.',
    'No, you do not need more confidence.',
    'Imposter syndrome is not your problem. The room is.',
    'Myth: senior women in tech get fewer opportunities. Reality below.',
  ],
  'Framework': [
    '3 questions to ask before you say yes to more scope.',
    'The 4-part visibility plan I give every client.',
    '5 sentences that get your work noticed by leadership.',
    'A 2-minute script for declining extra work.',
    '7 signals your manager reads before promotion season.',
    'How to write a brag document in 20 minutes.',
  ],
  'Launch': [
    'Doors open: the Gravity Assist cohort starts next month.',
    'I am opening 5 coaching spots for senior women in STEM.',
    'New free guide: the overlooked expert\'s promotion plan.',
    'Last call for the visibility workshop this Thursday.',
  ],
};

// Effect sizes so the data has real patterns for the takeaways to find.
const TYPE_LIFT = { 'Myth-Busting': 1.9, 'Pattern Naming': 1.5, 'Personal Story': 1.3, 'System Reframe': 1.1, 'Framework': 1.0, 'Launch': 0.6 };
const PERSONA_LIFT = { 'Scope Sponge': 1.4, 'Overlooked Expert': 1.15, 'Quiet Fixer': 0.9 };
const DAY_LIFT = [0.7, 1.1, 1.3, 1.2, 1.1, 0.9, 0.6]; // Sun..Sat
const TIMES = ['7:30 AM', '8:15 AM', '9:00 AM', '11:45 AM', '1:30 PM', '4:00 PM', '6:30 PM'];
const TIME_LIFT = { '7:30 AM': 1.1, '8:15 AM': 1.25, '9:00 AM': 1.15, '11:45 AM': 1.0, '1:30 PM': 0.9, '4:00 PM': 0.85, '6:30 PM': 0.95 };

const END = new Date(2026, 9, 20); // Oct 20, 2026
const START = new Date(END.getTime() - 150 * 86400000);

// Build posts: roughly 3 per week.
const posts = [];
const usedHooks = new Set();
let cursor = new Date(START);
let id = 7380000000000000000n;
while (cursor <= END) {
  const dow = cursor.getDay();
  const postToday = dow === 0 ? rand() < 0.15 : dow === 6 ? rand() < 0.25 : rand() < 0.5;
  if (postToday) {
    const type = pick(POST_TYPES);
    const persona = pick(PERSONAS);
    let hook = pick(HOOKS[type]);
    let tries = 0;
    while (usedHooks.has(hook) && tries < 10) { hook = pick(HOOKS[type]); tries++; }
    usedHooks.add(hook);
    const time = pick(TIMES);
    const base = between(1800, 5200);
    const lift = TYPE_LIFT[type] * PERSONA_LIFT[persona] * DAY_LIFT[dow] * TIME_LIFT[time] * (0.75 + rand() * 0.5);
    const impressions = Math.round(base * lift);
    const reactions = Math.round(impressions * (0.018 + rand() * 0.012) * (type === 'Myth-Busting' ? 1.2 : 1));
    const comments = Math.round(impressions * (0.004 + rand() * 0.006) * (TYPE_LIFT[type] / 1.2));
    const reposts = Math.round(impressions * (0.001 + rand() * 0.003));
    const date = new Date(cursor);
    id += BigInt(between(1000, 99999));
    posts.push({
      id: id.toString(),
      url: `https://www.linkedin.com/feed/update/urn:li:activity:${id.toString()}/`,
      date,
      time,
      hook,
      type,
      persona,
      impressions,
      membersReached: Math.round(impressions * (0.72 + rand() * 0.12)),
      reactions,
      comments,
      reposts,
      saves: Math.round(impressions * (0.002 + rand() * 0.004)),
      contentType: type === 'Framework' ? pick(['Carousel', 'Infographic', 'Text Only']) : type === 'Launch' ? pick(['Text Only', 'Video']) : pick(CONTENT_TYPES),
      funnel: type === 'Launch' ? 'Conversion' : type === 'Framework' ? pick(['Consideration', 'Nurture']) : pick(['Awareness', 'Awareness', 'Consideration']),
      pillars: rand() < 0.3 ? [pick(PILLARS), pick(PILLARS)] : [pick(PILLARS)],
    });
  }
  cursor = new Date(cursor.getTime() + 86400000);
}

const fmtUS = (d) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtNotion = (d, time) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${time}`;

// ---- Workbook ------------------------------------------------------------
const wb = XLSX.utils.book_new();

const totalImpressions = posts.reduce((a, p) => a + p.impressions, 0);
const discovery = [
  ['Overall Performance', `${fmtUS(START)} - ${fmtUS(END)}`],
  ['Impressions', totalImpressions],
  ['Members reached', Math.round(totalImpressions * 0.61)],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(discovery), 'DISCOVERY');

// Daily engagement, built from the posts plus a background hum.
const engagement = [['Date', 'Impressions', 'Engagements']];
for (let d = new Date(START); d <= END; d = new Date(d.getTime() + 86400000)) {
  const todays = posts.filter((p) => p.date.toDateString() === d.toDateString());
  const yesterdays = posts.filter((p) => Math.round((d - p.date) / 86400000) === 1);
  let imp = between(120, 420);
  let eng = between(2, 9);
  for (const p of todays) { imp += Math.round(p.impressions * 0.6); eng += Math.round((p.reactions + p.comments + p.reposts) * 0.6); }
  for (const p of yesterdays) { imp += Math.round(p.impressions * 0.3); eng += Math.round((p.reactions + p.comments + p.reposts) * 0.3); }
  engagement.push([fmtUS(d), imp, eng]);
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(engagement), 'ENGAGEMENT');

// Top posts in LinkedIn's side-by-side layout, with a per-post breakdown
// added in the second table so comments can be analyzed.
const byEng = [...posts].sort((a, b) => (b.reactions + b.comments + b.reposts) - (a.reactions + a.comments + a.reposts));
const byImp = [...posts].sort((a, b) => b.impressions - a.impressions);
const topPosts = [
  ['Top posts by engagements', null, null, null, 'Top posts by impressions', null, null, null, null, null, null, null],
  ['Post URL', 'Post publish date', 'Engagements', null, 'Post URL', 'Post publish date', 'Impressions', 'Members reached', 'Reactions', 'Comments', 'Reposts', 'Saves'],
];
for (let i = 0; i < posts.length; i++) {
  const a = byEng[i];
  const b = byImp[i];
  topPosts.push([
    a.url, fmtUS(a.date), a.reactions + a.comments + a.reposts, null,
    b.url, fmtUS(b.date), b.impressions, b.membersReached, b.reactions, b.comments, b.reposts, b.saves,
  ]);
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(topPosts), 'TOP POSTS');

const followers = [['Date', 'New followers']];
for (let d = new Date(START); d <= END; d = new Date(d.getTime() + 86400000)) {
  const todays = posts.filter((p) => p.date.toDateString() === d.toDateString());
  let n = between(0, 4);
  for (const p of todays) n += Math.round(p.impressions / 400);
  followers.push([fmtUS(d), n]);
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(followers), 'FOLLOWERS');

const demographics = [['Top Demographics', 'Value', 'Percentage']];
const demo = {
  'Job titles': [['Software Engineer', 0.14], ['Senior Software Engineer', 0.11], ['Engineering Manager', 0.09], ['Data Scientist', 0.07], ['Product Manager', 0.06]],
  Locations: [['San Francisco Bay Area', 0.18], ['New York City Metropolitan Area', 0.12], ['Seattle', 0.09], ['Boston', 0.06], ['Austin', 0.05]],
  Industries: [['Software Development', 0.27], ['IT Services and IT Consulting', 0.14], ['Technology, Information and Internet', 0.11], ['Biotechnology Research', 0.07], ['Higher Education', 0.05]],
  Seniority: [['Senior', 0.38], ['Entry', 0.17], ['Manager', 0.15], ['Director', 0.09], ['VP', 0.04], ['CXO', 0.03], ['Owner', 0.03]],
  'Company size': [['10,001+ employees', 0.31], ['1,001-5,000 employees', 0.18], ['51-200 employees', 0.14], ['201-500 employees', 0.1]],
  'Job function': [['Engineering', 0.41], ['Information Technology', 0.12], ['Research', 0.08], ['Operations', 0.07], ['Product Management', 0.06]],
};
for (const [group, rows] of Object.entries(demo)) {
  rows.forEach(([label, pct], i) => demographics.push([i === 0 ? group : null, label, pct]));
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(demographics), 'DEMOGRAPHICS');

XLSX.writeFile(wb, join(outDir, 'linkedin-sample-export.xlsx'));

// A second workbook with a renamed sheet and a missing one, for the error path.
const wb2 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(discovery), 'Overview');
XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(topPosts), 'Content');
XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(followers), 'Audience Growth');
XLSX.writeFile(wb2, join(outDir, 'linkedin-sample-export-renamed-sheets.xlsx'));

// ---- Calendar CSV ---------------------------------------------------------
const csvEscape = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const header = ['Name', 'Publication Date', 'Live Post Link', 'Platform', 'Status', 'Content Type', 'Funnel', 'Content Pillars', 'Impressions', 'Reactions', 'Comments', 'Reposts', 'Saves', 'New Followers', 'Notes', 'Assignee'];
const csvRows = [header.join(',')];
posts.forEach((p, i) => {
  // Leave a few links blank so date matching gets exercised, and leave one
  // date deliberately off so it shows in the unmatched list.
  const blankLink = i % 9 === 4;
  const brokenDate = i === 13; // this row also has a blank link
  const logged = i % 3 === 0;
  const date = brokenDate ? new Date(p.date.getTime() + 2 * 86400000) : p.date;
  csvRows.push([
    p.hook,
    fmtNotion(date, p.time),
    blankLink ? '' : p.url,
    'LinkedIn',
    'Published',
    p.contentType,
    p.funnel,
    p.pillars.map(([n, l]) => `${n} (${l})`).join(', '),
    logged ? p.impressions : '',
    logged ? p.reactions : '',
    logged ? p.comments : '',
    logged ? p.reposts : '',
    logged ? p.saves : '',
    logged ? between(2, 25) : '',
    '',
    'Jennifer',
  ].map(csvEscape).join(','));
});
// Rows that must be ignored
csvRows.push(['Newsletter: the quiet fixer trap', fmtNotion(posts[3].date, '9:00 AM'), '', 'Newsletter', 'Published', 'Text Only', 'Nurture', 'Visibility (https://www.notion.so/Visibility-1a2b3c4d5e6f7081)', '', '', '', '', '', '', '', 'Jennifer'].map(csvEscape).join(','));
csvRows.push(['Draft: why your 1:1s are not working', fmtNotion(END, '9:00 AM'), '', 'LinkedIn', 'Draft', 'Text Only', 'Awareness', '', '', '', '', '', '', '', '', 'Jennifer'].map(csvEscape).join(','));
csvRows.push(['Scheduled: the brag doc template', fmtNotion(new Date(END.getTime() + 3 * 86400000), '8:15 AM'), '', 'LinkedIn', 'Scheduled', 'Carousel', 'Consideration', '', '', '', '', '', '', '', '', 'Jennifer'].map(csvEscape).join(','));
writeFileSync(join(outDir, 'content-calendar-sample.csv'), csvRows.join('\n') + '\n');

// ---- Tags JSON ------------------------------------------------------------
const tags = { version: 1, updatedAt: new Date(2026, 9, 21, 9, 0, 0).toISOString(), posts: {} };
posts.forEach((p, i) => {
  // Leave a handful untagged so the tagging table has work to do.
  if (i % 11 === 6) return;
  tags.posts[p.url] = { postType: p.type, persona: p.persona };
});
writeFileSync(join(outDir, 'tags-sample.json'), JSON.stringify(tags, null, 2) + '\n');

console.log(`Wrote ${posts.length} synthetic posts to ${outDir}`);
