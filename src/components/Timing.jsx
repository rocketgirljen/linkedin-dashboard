import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import Section from './Section.jsx';
import { baseOptions, cssVar, percentTicks } from '../charts.js';
import { groupStats, formatPercent } from '../lib/metrics.js';
import { DAYS_OF_WEEK, TIME_BUCKETS, MIN_GROUP_SIZE } from '../lib/constants.js';

function chart(rows, labelKey) {
  const real = rows.filter((r) => r.count > 0 && r.key !== 'Unknown');
  const brand = cssVar('--brand');
  const soft = cssVar('--accent-5');
  return {
    data: {
      labels: real.map((r) => `${labelKey === 'day' ? r.key.slice(0, 3) : r.key} (${r.count})`),
      datasets: [{ label: 'Average engagement rate', data: real.map((r) => r.avgEngagementRate), backgroundColor: real.map((r) => (r.count >= MIN_GROUP_SIZE ? brand : soft)), borderRadius: 6 }],
    },
    options: baseOptions({
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => formatPercent(c.parsed.y) } } },
      scales: { y: { ticks: { color: cssVar('--text-muted'), ...percentTicks() }, grid: { color: cssVar('--grid') }, beginAtZero: true }, x: { ticks: { color: cssVar('--text') }, grid: { display: false } } },
    }),
    real,
  };
}

export default function Timing({ posts }) {
  const dated = posts.filter((p) => p.date);
  const dayRows = useMemo(() => groupStats(dated, 'dayOfWeek', { order: DAYS_OF_WEEK }), [dated]);
  const timeRows = useMemo(() => groupStats(dated, 'timeBucket', { order: TIME_BUCKETS }), [dated]);
  const unknownTime = timeRows.find((r) => r.key === 'Unknown')?.count || 0;
  const knownTime = dated.length - unknownTime;

  if (!dated.length) {
    return <Section number={6} title="Timing"><p className="muted">No post dates found.</p></Section>;
  }
  const day = chart(dayRows, 'day');
  const time = chart(timeRows, 'time');
  const bestDay = [...day.real].filter((r) => r.count >= MIN_GROUP_SIZE).sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0];

  return (
    <Section number={6} title="Timing" hint={bestDay ? `Best day so far: ${bestDay.key}` : 'Not enough posts per day yet to name a best day'}>
      <div className="two-col">
        <div>
          <h3>By day of week</h3>
          <div className="chart-wrap"><Bar data={day.data} options={day.options} /></div>
        </div>
        <div>
          <h3>By time of day</h3>
          {knownTime > 0 ? (
            <div className="chart-wrap"><Bar data={time.data} options={time.options} /></div>
          ) : (
            <p className="muted">LinkedIn's export only gives the date, not the time. Load your Notion calendar, which includes the publication time, to fill this chart.</p>
          )}
          {knownTime > 0 && unknownTime > 0 && <p className="legend-note">{unknownTime} {unknownTime === 1 ? 'post has' : 'posts have'} no time of day (not in the calendar) and are left out here.</p>}
        </div>
      </div>
      <p className="legend-note">Times use your computer's time zone. Lighter bars have fewer than {MIN_GROUP_SIZE} posts.</p>
    </Section>
  );
}
