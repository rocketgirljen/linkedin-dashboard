import React from 'react';
import { Bar, Line } from 'react-chartjs-2';
import Section from './Section.jsx';
import { Tile } from './Overview.jsx';
import { baseOptions, cssVar } from '../charts.js';
import { formatNumber } from '../lib/metrics.js';

const SENIOR_LEVELS = ['senior', 'manager', 'director', 'vp', 'cxo', 'owner', 'partner', 'executive'];
const STEM_WORDS = ['engineer', 'software', 'technology', 'it ', 'information technology', 'research', 'data', 'science', 'scientist', 'biotech', 'pharma', 'medical', 'health', 'computer', 'semiconductor', 'aerospace', 'defense', 'telecom', 'manufactur', 'chemical', 'energy', 'robotics', 'math', 'analytics', 'product management', 'quality assurance'];

function pctList(list, matcher) {
  return (list || []).filter((r) => matcher(r.label.toLowerCase())).reduce((a, r) => a + r.percentage, 0);
}

function HBar({ rows, color }) {
  const data = {
    labels: rows.map((r) => r.label),
    datasets: [{ label: 'Share of viewers', data: rows.map((r) => r.percentage), backgroundColor: color, borderRadius: 6 }],
  };
  const options = baseOptions({
    indexAxis: 'y',
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.parsed.x.toFixed(1)}%` } } },
    scales: {
      x: { ticks: { color: cssVar('--text-muted'), callback: (v) => `${v}%` }, grid: { color: cssVar('--grid') }, beginAtZero: true },
      y: { ticks: { color: cssVar('--text') }, grid: { display: false } },
    },
  });
  return <div className="chart-wrap" style={{ height: Math.max(160, 36 * rows.length + 30) }}><Bar data={data} options={options} /></div>;
}

export default function AudienceFit({ demographics, followers, missing }) {
  const seniorShare = demographics ? pctList(demographics.seniority, (l) => SENIOR_LEVELS.some((s) => l.includes(s)) && !l.includes('entry')) : null;
  const functions = demographics?.jobFunction || demographics?.jobTitle || null;
  const functionLabel = demographics?.jobFunction ? 'job functions' : 'job titles';
  const stemFunctionShare = functions ? pctList(functions, (l) => STEM_WORDS.some((w) => l.includes(w))) : null;
  const stemIndustryShare = demographics?.industry ? pctList(demographics.industry, (l) => STEM_WORDS.some((w) => l.includes(w))) : null;

  const followerChart = followers && followers.length ? buildFollowerChart(followers) : null;
  const totalNew = followers ? followers.reduce((a, f) => a + (f.newFollowers || 0), 0) : null;

  const verdict = seniorShare == null ? null : seniorShare >= 50 ? 'Mostly mid-to-senior. Good fit.' : seniorShare >= 35 ? 'A solid mid-to-senior core, with room to grow.' : 'Skewing junior. Worth watching.';

  return (
    <Section number={8} title="Audience Fit" hint="Are viewers mid-to-senior and in STEM?">
      {missing.includes('Demographics') && <p className="notice warn">The Demographics sheet was not in this export, so audience seniority, function, and industry are hidden. Check that the export covers a range with enough viewers.</p>}
      {demographics && (
        <>
          <div className="tiles">
            <Tile label="Senior level and above" value={seniorShare == null ? 'n/a' : `${seniorShare.toFixed(0)}%`} />
            <Tile label={`STEM-related ${functionLabel} (top listed)`} value={stemFunctionShare == null ? 'n/a' : `${stemFunctionShare.toFixed(0)}%`} />
            <Tile label="STEM-related industries (top listed)" value={stemIndustryShare == null ? 'n/a' : `${stemIndustryShare.toFixed(0)}%`} />
            {totalNew != null && <Tile label="New followers in export" value={formatNumber(totalNew)} />}
          </div>
          {verdict && <p style={{ marginBottom: 12 }}><strong>{verdict}</strong> <span className="muted small">"Senior and above" counts Senior, Manager, Director, VP, CXO, Owner, and Partner. LinkedIn lists only the top few values per category, so STEM shares are a floor, not a total.</span></p>}
          <div className="two-col">
            <div>
              <h3>Seniority</h3>
              {demographics.seniority ? <HBar rows={demographics.seniority} color={cssVar('--brand')} /> : <p className="muted">Not in this export.</p>}
            </div>
            <div>
              <h3>Top {functionLabel}</h3>
              {functions ? <HBar rows={functions.slice(0, 8)} color={cssVar('--accent-3')} /> : <p className="muted">Not in this export.</p>}
            </div>
            <div>
              <h3>Top industries</h3>
              {demographics.industry ? <HBar rows={demographics.industry.slice(0, 8)} color={cssVar('--accent-2')} /> : <p className="muted">Not in this export.</p>}
            </div>
            <div>
              <h3>Follower growth</h3>
              {followerChart ? <div className="chart-wrap" style={{ height: 240 }}><Line data={followerChart.data} options={followerChart.options} /></div> : <p className="muted">{missing.includes('Followers') ? 'The Followers sheet was not in this export.' : 'No follower rows found.'}</p>}
            </div>
          </div>
        </>
      )}
      {!demographics && followerChart && (
        <div>
          <h3>Follower growth</h3>
          <div className="chart-wrap"><Line data={followerChart.data} options={followerChart.options} /></div>
        </div>
      )}
    </Section>
  );
}

function buildFollowerChart(followers) {
  const weekly = followers.length > 45;
  const buckets = new Map();
  for (const f of followers) {
    const d = new Date(f.date);
    if (weekly) d.setDate(d.getDate() - d.getDay());
    const k = d.toDateString();
    const b = buckets.get(k) || { date: d, newFollowers: 0, cumulative: 0 };
    b.newFollowers += f.newFollowers || 0;
    b.cumulative = f.cumulativeNew;
    buckets.set(k, b);
  }
  const list = [...buckets.values()];
  const brand = cssVar('--brand');
  const accent = cssVar('--accent-3');
  return {
    data: {
      labels: list.map((b) => b.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [
        { type: 'bar', label: `New followers${weekly ? ' (weekly)' : ''}`, data: list.map((b) => b.newFollowers), backgroundColor: accent, yAxisID: 'y', borderRadius: 4 },
        { type: 'line', label: 'Running total', data: list.map((b) => b.cumulative), borderColor: brand, backgroundColor: brand, yAxisID: 'y1', tension: 0.3, pointRadius: 0 },
      ],
    },
    options: baseOptions({
      scales: {
        y: { position: 'left', ticks: { color: cssVar('--text-muted') }, grid: { color: cssVar('--grid') }, beginAtZero: true },
        y1: { position: 'right', ticks: { color: cssVar('--text-muted') }, grid: { drawOnChartArea: false }, beginAtZero: true },
      },
    }),
  };
}
