import React from 'react';
import Section from './Section.jsx';

export default function Takeaways({ sentences, rangeLabel }) {
  return (
    <Section number={1} title="This Week's Takeaways" hint={`Based on posts ${rangeLabel}`} className="takeaways">
      <ol>
        {sentences.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      <p className="legend-note">A group is only named once it has at least 3 posts. Tag more posts to unlock more comparisons.</p>
    </Section>
  );
}
