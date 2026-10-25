import React from 'react';

export default function Section({ number, title, hint, children, id, className = '' }) {
  return (
    <section className={`card ${className}`} id={id}>
      <div className="card-head">
        <h2>{number != null && <span className="section-num">{number}</span>}{title}</h2>
        {hint && <span className="hint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function Notice({ kind = '', children }) {
  return <div className={`notice ${kind}`}>{children}</div>;
}
