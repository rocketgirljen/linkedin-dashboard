import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import Section from './Section.jsx';
import { baseOptions, cssVar, percentTicks } from '../charts.js';
import { formatNumber, formatPercent } from '../lib/metrics.js';
import { formatShortDate } from '../lib/dates.js';

const RANGES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: null, label: 'All' },
];

export default function Overview({ range, setRange, totals, engagement, discovery, posts, anchorDate }) {
  const trend = useMemo(() => buildTrend(engagement, posts, range, anchorDate), [engagement, posts, range, anchorDate]);

  return (
    <Section number={2} title="Overview" hint={anchorDate ? `Newest data: ${formatShortDate(anchorDate)}` : ''}>
      <div className="toolbar">
        <div className="range-picker" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r.label} className={range === r.days ? 'active' : ''} onClick={() => setRange(r.days)}>{r.label}</button>
          ))}
        </div>
        <span className="muted small">Ranges count back from the newest date in your export, not from today.</span>
      </div>
      <div className="tiles">
        <Tile label="Posts" value={formatNumber(totals.posts)} />
        <Tile label="Impressions" value={formatNumber(totals.impressions)} />
        <Tile label="Engagement rate" value={formatPercent(totals.engagementRate)} />
        <Tile label="Reactions" value={formatNumber(totals.reactions)} />
        <Tile label="Comments" value={formatNumber(totals.comments)} />
        <Tile label="Reposts" value={formatNumber(totals.reposts)} />
        <Tile label="Comments per 1,000" value={totals.commentsPerThousand == null ? 'n/a' : totals.commentsPerThousand.toFixed(1)} />
        {discovery?.membersReached != null && <Tile label="Members reached (export total)" value={formatNumber(discovery.membersReached)} small />}
      </div>
      {trend ? (
        <div className="chart-wrap">
          <Line data={trend.data} options={trend.options} />
        </div>
      ) : (
        <p className="muted">No daily engagement data in this export, so the trend line is hidden.</p>
      )}
    </Section>
  );
}

export function Tile({ label, value, small }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className={`value ${small ? 'small' : ''}`}>{value}</div>
    </div>
  );
}

function buildTrend(engagement, posts, rangeDays, anchorDate) {
  let rows = engagement && engagement.length ? engagement : null;
  if (!rows) {
    // Fall back to per-post daily sums when the Engagement sheet is missing.
    const byDay = new Map();
    for (const p of posts) {
      if (!p.date) continue;
      const k = p.date.toDateString();
      const row = byDay.get(k) || { date: new Date(p.date.getFullYear(), p.date.getMonth(), p.date.getDate()), impressions: 0, engagements: 0 };
      row.impressions += p.impressions || 0;
      row.engagements += p.totalEngagements || 0;
      byDay.set(k, row);
    }
    rows = [...byDay.values()].sort((a, b) => a.date - b.date);
  }
  if (!rows.length) return null;
  if (rangeDays && anchorDate) {
    const cutoff = new Date(anchorDate.getTime() - rangeDays * 86400000);
    rows = rows.filter((r) => r.date >= cutoff);
  }
  // Weekly buckets keep the line readable on long ranges.
  const weekly = rows.length > 45;
  const buckets = new Map();
  for (const r of rows) {
    const d = new Date(r.date);
    if (weekly) d.setDate(d.getDate() - d.getDay());
    const k = d.toDateString();
    const b = buckets.get(k) || { date: d, impressions: 0, engagements: 0 };
    b.impressions += r.impressions || 0;
    b.engagements += r.engagements || 0;
    buckets.set(k, b);
  }
  const list = [...buckets.values()];
  const labels = list.map((b) => b.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  const brand = cssVar('--brand');
  const accent = cssVar('--accent-2');
  return {
    data: {
      labels,
      datasets: [
        { label: `Impressions${weekly ? ' (weekly)' : ''}`, data: list.map((b) => b.impressions), borderColor: brand, backgroundColor: brand, yAxisID: 'y', tension: 0.3, pointRadius: 2 },
        { label: 'Engagement rate', data: list.map((b) => (b.impressions ? b.engagements / b.impressions : null)), borderColor: accent, backgroundColor: accent, yAxisID: 'y1', tension: 0.3, pointRadius: 2 },
      ],
    },
    options: baseOptions({
      scales: {
        y: { position: 'left', ticks: { color: cssVar('--text-muted') }, grid: { color: cssVar('--grid') }, beginAtZero: true },
        y1: { position: 'right', ticks: { color: cssVar('--text-muted'), ...percentTicks() }, grid: { drawOnChartArea: false }, beginAtZero: true },
      },
      plugins: {
        tooltip: { callbacks: { label: (ctx) => ctx.dataset.yAxisID === 'y1' ? `${ctx.dataset.label}: ${formatPercent(ctx.parsed.y)}` : `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)}` } },
      },
    }),
  };
}
