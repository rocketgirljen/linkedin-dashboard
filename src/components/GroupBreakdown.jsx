import React from 'react';
import { Bar } from 'react-chartjs-2';
import Section from './Section.jsx';
import { baseOptions, cssVar, percentTicks } from '../charts.js';
import { formatNumber, formatPercent } from '../lib/metrics.js';
import { MIN_GROUP_SIZE } from '../lib/constants.js';

// One reusable section: bar chart of average engagement rate plus a table.
export default function GroupBreakdown({ number, title, rows, groupLabel, emptyMessage, hint, hasComments }) {
  const real = rows.filter((r) => r.key !== 'Untagged' && r.key !== 'Unknown');
  const untagged = rows.find((r) => r.key === 'Untagged' || r.key === 'Unknown');

  if (!real.length) {
    return (
      <Section number={number} title={title} hint={hint}>
        <p className="muted">{emptyMessage}</p>
      </Section>
    );
  }

  const brand = cssVar('--brand');
  const soft = cssVar('--accent-5');
  const data = {
    labels: real.map((r) => `${r.key} (${r.count})`),
    datasets: [{
      label: 'Average engagement rate',
      data: real.map((r) => r.avgEngagementRate),
      backgroundColor: real.map((r) => (r.count >= MIN_GROUP_SIZE ? brand : soft)),
      borderRadius: 6,
    }],
  };
  const options = baseOptions({
    indexAxis: 'y',
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => formatPercent(c.parsed.x) } } },
    scales: {
      x: { ticks: { color: cssVar('--text-muted'), ...percentTicks() }, grid: { color: cssVar('--grid') }, beginAtZero: true },
      y: { ticks: { color: cssVar('--text') }, grid: { display: false } },
    },
  });

  return (
    <Section number={number} title={title} hint={hint}>
      <div className="two-col chart-table">
        <div className="chart-wrap" style={{ height: Math.max(180, 44 * real.length + 40) }}>
          <Bar data={data} options={options} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{groupLabel}</th>
                <th className="num">Posts</th>
                <th className="num">Avg eng. rate</th>
                {hasComments && <th className="num">Avg comments</th>}
                {hasComments && <th className="num">Comments / 1k</th>}
                <th className="num">Avg impressions</th>
              </tr>
            </thead>
            <tbody>
              {real.map((r) => (
                <tr key={r.key} className={r.count < MIN_GROUP_SIZE ? 'low' : ''}>
                  <td>{r.key}{r.count < MIN_GROUP_SIZE && <span className="badge">needs {MIN_GROUP_SIZE - r.count} more</span>}</td>
                  <td className="num">{r.count}</td>
                  <td className="num">{formatPercent(r.avgEngagementRate)}</td>
                  {hasComments && <td className="num">{formatNumber(r.avgComments, 1)}</td>}
                  {hasComments && <td className="num">{formatNumber(r.avgCommentsPerThousand, 1)}</td>}
                  <td className="num">{formatNumber(r.avgImpressions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {untagged && <p className="legend-note">{untagged.count} {untagged.count === 1 ? 'post is' : 'posts are'} not tagged yet and are left out of this chart. Lighter bars have fewer than {MIN_GROUP_SIZE} posts.</p>}
          {!untagged && <p className="legend-note">Lighter bars have fewer than {MIN_GROUP_SIZE} posts, so treat them as early signals.</p>}
        </div>
      </div>
    </Section>
  );
}
