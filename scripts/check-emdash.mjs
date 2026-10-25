// Fails when the em dash character appears anywhere in the repository.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'dist', 'data']);
const EM_DASH = String.fromCharCode(0x2014);
const hits = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    if (/\.(xlsx|png|jpg|jpeg|gif|ico|woff2?|lock)$/i.test(entry)) continue;
    const text = readFileSync(full, 'utf8');
    text.split('\n').forEach((line, i) => {
      if (line.includes(EM_DASH)) hits.push(`${full}:${i + 1}`);
    });
  }
}

walk(process.cwd());
if (hits.length) {
  console.error('Em dash found in:\n' + hits.join('\n'));
  process.exit(1);
}
console.log('No em dashes found.');
