import React, { useEffect, useMemo, useState, useCallback } from 'react';
import FileLoader from './components/FileLoader.jsx';
import Takeaways from './components/Takeaways.jsx';
import Overview from './components/Overview.jsx';
import GroupBreakdown from './components/GroupBreakdown.jsx';
import HookAnalysis from './components/HookAnalysis.jsx';
import Timing from './components/Timing.jsx';
import PostsTable from './components/PostsTable.jsx';
import AudienceFit from './components/AudienceFit.jsx';
import Tagging from './components/Tagging.jsx';
import { Notice } from './components/Section.jsx';
import { parseXlsxFile, parseXlsxBuffer } from './lib/xlsxParser.js';
import { parseCalendarText } from './lib/calendar.js';
import { matchPosts } from './lib/matching.js';
import { enrichPost, groupStats, totals, filterByRange, newestDate } from './lib/metrics.js';
import { generateTakeaways } from './lib/takeaways.js';
import { emptyTags, setTag, parseTagsJson, tagsToJson, applyTags } from './lib/tags.js';
import { POST_TYPES, PERSONAS } from './lib/constants.js';

const TAGS_STORAGE_KEY = 'linkedin-dashboard-tags-v1';
const THEME_KEY = 'linkedin-dashboard-theme';

function loadStoredTags() {
  try {
    const raw = localStorage.getItem(TAGS_STORAGE_KEY);
    return raw ? parseTagsJson(raw) : emptyTags();
  } catch { return emptyTags(); }
}

function useTheme() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; } });
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage unavailable */ }
  }, [theme]);
  return [theme, setTheme];
}

export default function App() {
  const [theme, setTheme] = useTheme();
  const [exportData, setExportData] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [tags, setTags] = useState(loadStoredTags);
  const [range, setRange] = useState(90);
  const [status, setStatus] = useState({ export: { text: 'No file yet' }, calendar: { text: 'No file yet' }, tags: { text: Object.keys(loadStoredTags().posts).length ? 'Using tags saved in this browser' : 'No file yet' } });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Persist tags in the browser as a convenience. The JSON download is the real backup.
  useEffect(() => {
    try { localStorage.setItem(TAGS_STORAGE_KEY, tagsToJson(tags)); } catch { /* storage unavailable */ }
  }, [tags]);

  const setStatusFor = (key, text, ok) => setStatus((s) => ({ ...s, [key]: { text, ok } }));

  const handleExport = useCallback(async (file) => {
    setError(null);
    setBusy(true);
    try {
      const parsed = await parseXlsxFile(file);
      if (!parsed.posts.length && parsed.missingSheets.length === 5) {
        setError(`"${file.name}" does not look like a LinkedIn analytics export. None of the expected sheets (Discovery, Engagement, Top Posts, Followers, Demographics) were found. Sheets present: ${parsed.sheetNames.join(', ')}.`);
        setStatusFor('export', 'Could not read this file', false);
        return;
      }
      setExportData(parsed);
      setStatusFor('export', `Loaded ${file.name}: ${parsed.posts.length} posts`, true);
    } catch (e) {
      setError(`Could not read "${file.name}": ${e.message}`);
      setStatusFor('export', 'Could not read this file', false);
    } finally { setBusy(false); }
  }, []);

  const handleCalendar = useCallback(async (file) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseCalendarText(text);
      setCalendar(parsed);
      setStatusFor('calendar', `Loaded ${file.name}: ${parsed.posts.length} published LinkedIn rows`, true);
    } catch (e) {
      setError(`Could not read "${file.name}": ${e.message}`);
      setStatusFor('calendar', 'Could not read this file', false);
    }
  }, []);

  const handleTags = useCallback(async (file) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseTagsJson(text);
      setTags(parsed);
      setStatusFor('tags', `Loaded ${file.name}: ${Object.keys(parsed.posts).length} tagged posts`, true);
    } catch (e) {
      setError(`Could not read "${file.name}": ${e.message}`);
      setStatusFor('tags', 'Could not read this file', false);
    }
  }, []);

  const loadSample = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
      const [xlsx, csv, json] = await Promise.all([
        fetch(`${base}sample/linkedin-sample-export.xlsx`).then((r) => r.arrayBuffer()),
        fetch(`${base}sample/content-calendar-sample.csv`).then((r) => r.text()),
        fetch(`${base}sample/tags-sample.json`).then((r) => r.text()),
      ]);
      const parsed = parseXlsxBuffer(new Uint8Array(xlsx));
      setExportData(parsed);
      setStatusFor('export', `Loaded sample export: ${parsed.posts.length} posts`, true);
      const cal = parseCalendarText(csv);
      setCalendar(cal);
      setStatusFor('calendar', `Loaded sample calendar: ${cal.posts.length} published LinkedIn rows`, true);
      const t = parseTagsJson(json);
      setTags(t);
      setStatusFor('tags', `Loaded sample tags: ${Object.keys(t.posts).length} tagged posts`, true);
    } catch (e) {
      setError(`Could not load the sample files: ${e.message}`);
    } finally { setBusy(false); }
  }, []);

  // ---- Derived data ---------------------------------------------------------
  const matched = useMemo(() => {
    if (!exportData) return null;
    const calPosts = calendar ? calendar.posts.map((c) => ({ ...c, matched: false, matchProblem: null })) : [];
    return matchPosts(exportData.posts, calPosts);
  }, [exportData, calendar]);

  const allPosts = useMemo(() => (matched ? applyTags(matched.posts, tags).map(enrichPost) : []), [matched, tags]);
  const anchorDate = useMemo(() => newestDate(allPosts) || (exportData?.engagement ? newestDate(exportData.engagement) : null), [allPosts, exportData]);
  const posts = useMemo(() => filterByRange(allPosts, range, anchorDate), [allPosts, range, anchorDate]);
  const rangeLabel = range ? `in the last ${range} days` : 'across all time';
  const hasComments = posts.some((p) => p.comments != null);

  const sums = useMemo(() => totals(posts), [posts]);
  const takeaways = useMemo(() => generateTakeaways(posts, { rangeLabel }), [posts, rangeLabel]);
  const byType = useMemo(() => groupStats(posts, 'postType', { order: [...POST_TYPES, 'Untagged'] }), [posts]);
  const byPersona = useMemo(() => groupStats(posts, 'persona', { order: [...PERSONAS, 'Untagged'] }), [posts]);
  const byFormat = useMemo(() => groupStats(posts, 'contentType'), [posts]);
  const byFunnel = useMemo(() => groupStats(posts, 'funnel', { order: ['Awareness', 'Consideration', 'Conversion', 'Nurture', 'Untagged'] }), [posts]);
  const byPillar = useMemo(() => groupStats(posts, (p) => (p.pillars && p.pillars.length ? p.pillars : null)), [posts]);

  const onTag = (urlKey, field, value) => setTags((t) => setTag(t, urlKey, field, value));
  const downloadTags = () => {
    const blob = new Blob([tagsToJson(tags, allPosts)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `linkedin-post-tags-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const clearTags = () => { if (window.confirm('Remove every Post Type and Persona tag from this browser? Download them first if you want a backup.')) setTags(emptyTags()); };

  const untaggedCount = allPosts.filter((p) => !p.postType || !p.persona).length;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>LinkedIn Post Dashboard</h1>
          <p className="sub">Which posts work, and why. Private: your files never leave this browser.</p>
        </div>
        <div className="topbar-actions">
          <label className="small muted">Theme{' '}
            <select className="tag" value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="auto">Match system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </header>

      <FileLoader
        onExport={handleExport} onCalendar={handleCalendar} onTags={handleTags} onSample={loadSample}
        exportStatus={status.export} calendarStatus={status.calendar} tagsStatus={status.tags} busy={busy}
      />

      {error && <Notice kind="bad">{error}</Notice>}

      {exportData && (
        <>
          {(exportData.missingSheets.length > 0 || exportData.notes.length > 0 || (calendar && calendar.warnings.length > 0)) && (
            <Notice kind="warn">
              <strong>Heads up</strong>
              <ul>
                {exportData.missingSheets.map((s) => <li key={s}>The "{s}" sheet is missing from this export, so that section is skipped or reduced.</li>)}
                {exportData.notes.map((n, i) => <li key={`n${i}`}>{n}</li>)}
                {calendar?.warnings.map((w, i) => <li key={`c${i}`}>{w}</li>)}
              </ul>
            </Notice>
          )}
          {!calendar && (
            <Notice>Load your Notion calendar CSV to add hooks, formats, funnel stages, and posting times. Without it the Hook Analysis and time-of-day charts stay empty.</Notice>
          )}
          {calendar && (calendar.hasPostTypeColumn || calendar.hasPersonaColumn) && (
            <Notice kind="good">Your calendar has {calendar.hasPostTypeColumn && calendar.hasPersonaColumn ? 'Post Type and Persona columns' : calendar.hasPostTypeColumn ? 'a Post Type column' : 'a Persona column'}. Those values are used as starting tags. Anything you pick below overrides them.</Notice>
          )}
          {untaggedCount > 0 && (
            <Notice kind="warn">{untaggedCount} of {allPosts.length} posts {untaggedCount === 1 ? 'is' : 'are'} missing a Post Type or Persona tag. <a href="#tagging">Tag them</a> to make sections 3 and 4 and the takeaways more useful.</Notice>
          )}

          <Takeaways sentences={takeaways} rangeLabel={rangeLabel} />
          <Overview range={range} setRange={setRange} totals={sums} engagement={exportData.engagement} discovery={exportData.discovery} posts={posts} anchorDate={anchorDate} />
          <GroupBreakdown number={3} title="Post Type Performance" rows={byType} groupLabel="Post type" hasComments={hasComments} emptyMessage="No posts have a Post Type tag yet. Tag them in the section at the bottom." />
          <GroupBreakdown number={4} title="Persona Performance" rows={byPersona} groupLabel="Persona" hasComments={hasComments} emptyMessage="No posts have a Persona tag yet. Tag them in the section at the bottom." />
          {calendar && (
            <>
              <GroupBreakdown number="4b" title="Performance by Format" rows={byFormat} groupLabel="Content type" hasComments={hasComments} hint="From the calendar's Content Type column" emptyMessage="No matched posts have a Content Type in the calendar." />
              <GroupBreakdown number="4c" title="Performance by Funnel Stage" rows={byFunnel} groupLabel="Funnel stage" hasComments={hasComments} hint="From the calendar's Funnel column" emptyMessage="No matched posts have a Funnel stage in the calendar." />
              <GroupBreakdown number="4d" title="Performance by Content Pillar" rows={byPillar} groupLabel="Pillar" hasComments={hasComments} hint="From the calendar's Content Pillars relation. A post with two pillars counts in both." emptyMessage="No matched posts have Content Pillars in the calendar." />
            </>
          )}
          <HookAnalysis posts={posts} />
          <Timing posts={posts} />
          <PostsTable posts={posts} />
          <AudienceFit demographics={exportData.demographics} followers={exportData.followers} missing={exportData.missingSheets} />
          <Tagging posts={allPosts} onTag={onTag} onDownload={downloadTags} onClear={clearTags} unmatchedCalendar={matched.unmatchedCalendar} unmatchedLinkedin={matched.unmatchedLinkedin} calendarLoaded={Boolean(calendar)} />
        </>
      )}

      {!exportData && (
        <div className="empty-state">
          <h2>Start with your LinkedIn export</h2>
          <p>Drop the .xlsx file above, or try the sample data to see every section filled in.</p>
        </div>
      )}

      <footer className="app-foot">Built for Gravity Assist LLC. No tracking, no uploads, no backend.</footer>
    </div>
  );
}
