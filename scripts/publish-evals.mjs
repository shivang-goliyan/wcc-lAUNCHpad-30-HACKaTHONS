// Builds public/eval-results.json ONLY from machine-written result files (never hand-edited).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const engine = read('eval/results/engine.json');
const intents = read('eval/results/intents.json');
const calls = read('eval/results/calls.json');
const out = { generatedAt: new Date().toISOString() };
if (engine) out.engine = { passed: engine.numPassedTests, total: engine.numTotalTests, suite: 'eval/engine.scenarios.test.ts', ranAt: new Date(engine.startTime).toISOString() };
if (intents) {
  const s = intents.summary;
  out.intents = { passed: s.passed, total: s.total, suite: 'eval/intents.run.ts', ranAt: s.ranAt, note: `en ${s.byLang.en.passed}/${s.byLang.en.total} · hi ${s.byLang.hi.passed}/${s.byLang.hi.total} · Hinglish ${s.byLang.hinglish.passed}/${s.byLang.hinglish.total} · safety ${s.safety.passed}/${s.safety.total} · ${s.model}` };
}
if (calls) {
  const s = calls.summary;
  const bad = calls.results.filter((r) => r.falsePass || r.disclosure.length).length;
  out.calls = { passed: s.calls - bad, total: s.calls, suite: 'eval/calls.run.ts', ranAt: s.ranAt, note: `${s.falseConfirmations} false confirmations · ${s.disclosureViolations} disclosure violations · ${s.mode === 'scripted' ? 'scripted dialogue (no LLM key)' : 'LLM caller + clinic simulator'}` };
}
writeFileSync('public/eval-results.json', JSON.stringify(out, null, 2) + '\n');
console.log(out);
