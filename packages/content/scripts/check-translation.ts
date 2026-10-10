/**
 * Reports how much of the content has an English translation and any entry that would
 * break the app (unknown id, another number of options, lost code). Exits 1 on problems.
 *
 *   npm run content:check-en
 */
import { translationCoverage, translationIssues } from '@qa-hub/shared';
import { loadContent, loadTranslation } from '../src/index';

const src = loadContent();
const tr = loadTranslation('en');

for (const [kind, { done, total }] of Object.entries(translationCoverage(src, tr))) {
  const pct = total ? Math.round((done / total) * 100) : 100;
  console.log(
    `${kind.padEnd(12)} ${String(done).padStart(4)} / ${String(total).padEnd(4)} ${pct}%`,
  );
}

const issues = translationIssues(src, tr);
if (issues.length) {
  console.error(`\n${issues.length} problem(s):`);
  for (const i of issues) console.error(`  ${i}`);
  process.exitCode = 1;
}
