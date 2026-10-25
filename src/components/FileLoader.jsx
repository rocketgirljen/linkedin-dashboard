import React, { useRef, useState } from 'react';

function DropZone({ title, help, accept, onFile, status, ok }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const handle = (files) => { if (files && files[0]) onFile(files[0]); };
  return (
    <label
      className={`dropzone ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
    >
      <strong>{title}</strong>
      <span className="muted small">{help}</span>
      <input ref={inputRef} type="file" accept={accept} onChange={(e) => { handle(e.target.files); e.target.value = ''; }} />
      <span className={`status ${ok ? 'ok' : ''}`}>{status}</span>
    </label>
  );
}

export default function FileLoader({ onExport, onCalendar, onTags, onSample, exportStatus, calendarStatus, tagsStatus, busy }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>Load your files</h2>
        <span className="hint">Everything stays in this browser tab. Nothing is uploaded anywhere.</span>
      </div>
      <div className="dropzones">
        <DropZone
          title="1. LinkedIn analytics export (.xlsx)"
          help="Required. Drag the file here or click to choose it."
          accept=".xlsx,.xls"
          onFile={onExport}
          status={exportStatus.text}
          ok={exportStatus.ok}
        />
        <DropZone
          title="2. Notion content calendar (.csv)"
          help="Optional. Adds hooks, formats, funnel stages, and pillars."
          accept=".csv,text/csv"
          onFile={onCalendar}
          status={calendarStatus.text}
          ok={calendarStatus.ok}
        />
        <DropZone
          title="3. Saved tags (.json)"
          help="Optional. Re-load the Post Type and Persona tags you saved last time."
          accept=".json,application/json"
          onFile={onTags}
          status={tagsStatus.text}
          ok={tagsStatus.ok}
        />
      </div>
      <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
        <button className="btn secondary small" onClick={onSample} disabled={busy}>Try it with sample data</button>
        <span className="muted small">The sample is made up. Use it to see how the dashboard looks before loading your own export.</span>
      </div>
    </div>
  );
}
