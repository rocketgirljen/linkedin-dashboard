import React, { useState } from 'react';
import Section from './Section.jsx';
import { POST_TYPES, PERSONAS } from '../lib/constants.js';
import { formatShortDate } from '../lib/dates.js';
import { formatNumber } from '../lib/metrics.js';

export default function Tagging({ posts, onTag, onDownload, onClear, unmatchedCalendar, unmatchedLinkedin, calendarLoaded }) {
  const [filter, setFilter] = useState('');
  const [onlyUntagged, setOnlyUntagged] = useState(false);
  const untagged = posts.filter((p) => !p.postType || !p.persona).length;
  const list = posts
    .filter((p) => !onlyUntagged || !p.postType || !p.persona)
    .filter((p) => !filter || (p.hook || '').toLowerCase().includes(filter.toLowerCase()) || p.url.includes(filter));

  return (
    <Section number={9} id="tagging" title="Tag Posts and Fix Matches" hint={untagged ? `${untagged} of ${posts.length} posts still need a tag` : 'Every post is tagged'}>
      <p className="muted small" style={{ marginBottom: 12 }}>
        Post Type and Persona are not in your Notion calendar, so pick them here. Tags are kept in this browser and, more importantly, in the JSON file you download. Load that file next time to get them back. Tags are keyed by post URL, so they survive new exports.
      </p>
      <div className="toolbar">
        <input className="search" placeholder="Search hooks" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <label className="small"><input type="checkbox" checked={onlyUntagged} onChange={(e) => setOnlyUntagged(e.target.checked)} /> Only untagged</label>
        <span className="spacer" />
        <button className="btn small" onClick={onDownload}>Download tags (.json)</button>
        <button className="btn secondary small" onClick={onClear}>Clear all tags</button>
      </div>
      <div className="table-wrap" style={{ maxHeight: 480, overflowY: 'auto' }}>
        <table>
          <thead>
            <tr><th>Hook</th><th>Date</th><th className="num">Impressions</th><th>Post Type</th><th>Persona</th></tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.urlKey}>
                <td className="hook-cell"><a href={p.url} target="_blank" rel="noreferrer">{p.hook || p.url.replace(/^https?:\/\/(www\.)?/, '')}</a></td>
                <td style={{ whiteSpace: 'nowrap' }}>{formatShortDate(p.date)}</td>
                <td className="num">{formatNumber(p.impressions)}</td>
                <td>
                  <select className={`tag ${p.postType ? '' : 'empty'}`} value={p.postType || ''} onChange={(e) => onTag(p.urlKey, 'postType', e.target.value)}>
                    <option value="">Choose type</option>
                    {POST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td>
                  <select className={`tag ${p.persona ? '' : 'empty'}`} value={p.persona || ''} onChange={(e) => onTag(p.urlKey, 'persona', e.target.value)}>
                    <option value="">Choose persona</option>
                    {PERSONAS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={5} className="muted">Nothing to show.</td></tr>}
          </tbody>
        </table>
      </div>

      {calendarLoaded && (
        <div style={{ marginTop: 20 }}>
          <h3>Calendar rows that did not match a LinkedIn post ({unmatchedCalendar.length})</h3>
          {unmatchedCalendar.length ? (
            <>
              <p className="muted small">Fix these in Notion by pasting the Live Post Link, or check the Publication Date. Then re-export the CSV.</p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Publication Date</th><th>Live Post Link</th><th>Why</th></tr></thead>
                  <tbody>
                    {unmatchedCalendar.map((c, i) => (
                      <tr key={i}>
                        <td className="hook-cell">{c.name}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatShortDate(c.date) || <span className="muted">missing</span>}</td>
                        <td>{c.url ? <a href={c.url} target="_blank" rel="noreferrer">link</a> : <span className="muted">blank</span>}</td>
                        <td className="small">{c.matchProblem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <p className="muted small">Every published LinkedIn row in the calendar matched a post in the export.</p>}
          {unmatchedLinkedin.length > 0 && (
            <p className="legend-note">{unmatchedLinkedin.length} {unmatchedLinkedin.length === 1 ? 'post' : 'posts'} in the LinkedIn export {unmatchedLinkedin.length === 1 ? 'has' : 'have'} no calendar row, so {unmatchedLinkedin.length === 1 ? 'it shows' : 'they show'} without a hook.</p>
          )}
        </div>
      )}
    </Section>
  );
}
