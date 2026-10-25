// Chart.js setup shared by every chart. Colors come from the CSS variables.
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler);

export function cssVar(name) {
  if (typeof window === 'undefined') return '#888';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

export function seriesColors() {
  return ['--brand', '--accent-2', '--accent-3', '--accent-4', '--accent-5', '--accent-6'].map(cssVar);
}

export function baseOptions(extra = {}) {
  const text = cssVar('--text-muted');
  const grid = cssVar('--grid');
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: text, boxWidth: 12 } },
      tooltip: { mode: 'index', intersect: false },
      ...(extra.plugins || {}),
    },
    scales: {
      x: { ticks: { color: text, maxRotation: 0, autoSkip: true }, grid: { display: false } },
      y: { ticks: { color: text }, grid: { color: grid }, beginAtZero: true },
      ...(extra.scales || {}),
    },
    ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'plugins' && k !== 'scales')),
  };
}

export function percentTicks() {
  return { callback: (v) => `${(v * 100).toFixed(1)}%` };
}
