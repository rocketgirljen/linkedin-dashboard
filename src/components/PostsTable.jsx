import React, { useMemo, useState } from 'react';
import Section from './Section.jsx';
import { formatNumber, formatPercent } from '../lib/metrics.js';
import { formatShortDate } from '../lib/dates.js';
import { HOOK_LIMIT } from '../lib/constants.js';

const COLUMNS = [
  { key: 'hook', label: 'Hook' },
  { key: 'date', label: 'Date' },
  { key: 'postType', label: 'Type' },
  { key: 'persona', label: 'Persona' },
  { key: 'impressions', label: 'Impressions', num: true },
  { key: 'reactions', label: 'Reactions', num: true },
  { key: 'comments', label: 'Comments', num: true },
  { key: 'reposts', label: 'Reposts', num: true },
  { key: 'engagementRate', label: 'Eng. rate', num: true },
  { key: 'commentsPerThousand', label: 'Comments / 1k', num: true },
];

function cell(p, key) {
  switch (key) {
    case 'hook': return (
      <span>
        <a href={p.url} target="_blank" rel="noreferrer">{p.hook || 'Open post'}</a>
        {p.hook && p.hook.length > HOOK_LIMIT && <span className="badge warn">{p.hook.length} chars</span>}
        {!p.hook && <span className="badge">no hook, not in calendar</span>}
      </span>
    );
    case 'date': return formatShortDate(p.date);
    case 'postType': return p.postType || <span className="muted">untagged</span>;
    case 'persona': return p.persona || <span className="muted">untagged</span>;
    case 'engagementRate': return formatPercent(p.engagementRate);
    case 'commentsPerThousand': return p.commentsPerThousand == null ? 'n/a' : p.commentsPerThousand.toFixed(1);
    default: return formatNumber(p[key]);
  }
}

function sortBy(list, key, dir) {
  const sorted = [...list].sort((a, b) => {
    const av = a[key]; const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av instanceof Date) return av - bv;
    if (typeof av === 'number') return av - bv;
    return String(av).localeCompare(String(bv));
  });
  return dir === 'desc' ? sorted.reverse() : sorted;
}

export default function PostsTable({ posts }) {
  const [sort, setSort] = useState({ key: 'engagementRate', dir: 'desc' });
  const [view, setView] = useState('top');
  const ranked = useMemo(() => sortBy(posts.filter((p) => p.engagementRate != null), 'engagementRate', 'desc'), [posts]);
  const subset = view === 'top' ? ranked.slice(0, 10) : view === 'bottom' ? ranked.slice(-10) : posts;
  const rows = sortBy(subset, sort.key, sort.dir);

  const toggle = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));

  return (
    <Section number={7} title="Top and Bottom 10 Posts" hint="Click a column heading to sort">
      <div className="toolbar">
        <div className="range-picker">
          <button className={view === 'top' ? 'active' : ''} onClick={() => setView('top')}>Top 10</button>
          <button className={view === 'bottom' ? 'active' : ''} onClick={() => setView('bottom')}>Bottom 10</button>
          <button className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>All ({posts.length})</button>
        </div>
        <span className="muted small">Ranked by engagement rate.</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={`sortable ${c.num ? 'num' : ''}`} onClick={() => toggle(c.key)}>
                  {c.label}{sort.key === c.key ? (sort.dir === 'desc' ? ' ▾' : ' ▴') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.urlKey}>
                {COLUMNS.map((c) => <td key={c.key} className={`${c.num ? 'num' : ''} ${c.key === 'hook' ? 'hook-cell' : ''}`}>{cell(p, c.key)}</td>)}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={COLUMNS.length} className="muted">No posts in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
