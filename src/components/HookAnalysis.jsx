import React, { useMemo } from 'react';
import { Scatter, Bar } from 'react-chartjs-2';
import Section from './Section.jsx';
import { baseOptions, cssVar, percentTicks } from '../charts.js';
import { groupStats, formatPercent, formatNumber } from '../lib/metrics.js';
import { HOOK_LIMIT, HOOK_OPENERS, MIN_GROUP_SIZE } from '../lib/constants.js';

export default function HookAnalysis({ posts }) {
  const withHooks = posts.filter((p) => p.hook);
  const over = withHooks.filter((p) => p.hookOverLimit);
  const openerRows = useMemo(() => groupStats(withHooks, 'hookOpener', { order: HOOK_OPENERS }), [withHooks]);

  if (!withHooks.length) {
    return (
      <Section number={5} title="Hook Analysis">
        <p className="muted">No hook text yet. Load your Notion calendar CSV so the post titles can be used as hooks. LinkedIn's export does not include post text.</p>
      </Section>
    );
  }

  const brand = cssVar('--brand');
  const warn = cssVar('--warn');
  const scatter = {
    datasets: [
      {
        label: `Hook within ${HOOK_LIMIT} characters`,
        data: withHooks.filter((p) => !p.hookOverLimit && p.engagementRate != null).map((p) => ({ x: p.hookLength, y: p.engagementRate, hook: p.hook })),
        backgroundColor: brand,
      },
      {
        label: `Hook over ${HOOK_LIMIT} characters`,
        data: over.filter((p) => p.engagementRate != null).map((p) => ({ x: p.hookLength, y: p.engagementRate, hook: p.hook })),
        backgroundColor: warn,
      },
    ],
  };
  const maxLen = Math.max(HOOK_LIMIT + 10, ...withHooks.map((p) => p.hookLength));
  const scatterOptions = baseOptions({
    plugins: {
      tooltip: { mode: 'nearest', intersect: true, callbacks: { label: (c) => [`${c.raw.hook}`, `${c.raw.x} characters, ${formatPercent(c.raw.y)} engagement`] } },
    },
    scales: {
      x: { type: 'linear', min: 0, max: maxLen + 5, title: { display: true, text: 'Hook length (characters)', color: cssVar('--text-muted') }, ticks: { color: cssVar('--text-muted') }, grid: { color: cssVar('--grid') } },
      y: { ticks: { color: cssVar('--text-muted'), ...percentTicks() }, grid: { color: cssVar('--grid') }, beginAtZero: true, title: { display: true, text: 'Engagement rate', color: cssVar('--text-muted') } },
    },
  });
  // Vertical marker at the character limit.
  const limitLine = {
    id: 'limitLine',
    afterDraw(chart) {
      const x = chart.scales.x.getPixelForValue(HOOK_LIMIT);
      const { top, bottom } = chart.chartArea;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = warn;
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      ctx.fillStyle = warn;
      ctx.font = '12px sans-serif';
      ctx.fillText(`${HOOK_LIMIT} char limit`, x + 6, top + 12);
      ctx.restore();
    },
  };

  const real = openerRows.filter((r) => r.count > 0);
  const openerData = {
    labels: real.map((r) => `${r.key} (${r.count})`),
    datasets: [{ label: 'Average engagement rate', data: real.map((r) => r.avgEngagementRate), backgroundColor: real.map((r) => (r.count >= MIN_GROUP_SIZE ? brand : cssVar('--accent-5'))), borderRadius: 6 }],
  };
  const openerOptions = baseOptions({
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => formatPercent(c.parsed.y) } } },
    scales: { y: { ticks: { color: cssVar('--text-muted'), ...percentTicks() }, grid: { color: cssVar('--grid') }, beginAtZero: true }, x: { ticks: { color: cssVar('--text') }, grid: { display: false } } },
  });

  const avgLen = withHooks.reduce((a, p) => a + p.hookLength, 0) / withHooks.length;

  return (
    <Section number={5} title="Hook Analysis" hint={`${over.length} of ${withHooks.length} hooks ran over ${HOOK_LIMIT} characters`}>
      <div className="two-col">
        <div>
          <h3>Hook length vs engagement</h3>
          <div className="chart-wrap">
            <Scatter data={scatter} options={scatterOptions} plugins={[limitLine]} />
          </div>
          <p className="legend-note">Average hook length: {avgLen.toFixed(0)} characters. Each dot is one post.</p>
        </div>
        <div>
          <h3>Performance by hook opener</h3>
          <div className="chart-wrap">
            <Bar data={openerData} options={openerOptions} />
          </div>
          <p className="legend-note">Question: starts with a question word or ends in "?". Number: starts with a digit. I statement: starts with "I" or "my". Contrarian: pushes back on a common belief.</p>
        </div>
      </div>
      {over.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary>Show the {over.length} {over.length === 1 ? 'hook' : 'hooks'} over {HOOK_LIMIT} characters</summary>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Hook</th><th className="num">Characters</th><th className="num">Eng. rate</th><th className="num">Impressions</th></tr></thead>
              <tbody>
                {over.sort((a, b) => b.hookLength - a.hookLength).map((p) => (
                  <tr key={p.urlKey}>
                    <td className="hook-cell">{p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.hook}</a> : p.hook}</td>
                    <td className="num">{p.hookLength}<span className="badge warn">+{p.hookLength - HOOK_LIMIT}</span></td>
                    <td className="num">{formatPercent(p.engagementRate)}</td>
                    <td className="num">{formatNumber(p.impressions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </Section>
  );
}
