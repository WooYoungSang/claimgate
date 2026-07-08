import { readFileSync, existsSync } from 'node:fs';
const docPath = 'docs/qa-simulation-harness.md';
const minScenarioCount = 10;
const requiredCoverage = [
  'No Anchor No Claim',
  'AI Curator Not Judge',
  'Risk-first Review',
  'Evidence Pack First',
  'DomainPack reuse',
  'UI hidden authority',
  'Public export hygiene',
  'Anti-overclaim',
  'Fixture-only performance framing'
];
const requiredCommands = [
  'pnpm test:submission-control-plane',
  'pnpm eval:framework',
  'pnpm test/conformance',
  'pnpm demo',
  'pnpm test:e2e',
  'pnpm test:perf'
];
const forbiddenPositiveClaims = [
  'ClaimGate eliminates hallucinations',
  'ClaimGate automatically determines truth',
  'ClaimGate proves production fact-checking accuracy',
  'ClaimGate proves real-world fact checking accuracy'
];
const noGos = [
  'real LLM extraction',
  'OCR',
  'PDF/Excel parsing',
  'server',
  'database',
  'auth',
  'multitenancy',
  'graph database',
  'real DID'
];
const requiredNoGoStatements = [
  'does **not** add real LLM extraction, OCR, PDF/Excel parsing, server, database, auth, multitenancy, graph database persistence, or real DID wallet/verifier behavior',
  'not real LLM/OCR/server/DB/DID evaluation'
];

if (!existsSync(docPath)) {
  fail(`Missing QA simulation harness: ${docPath}`);
}

const doc = readFileSync(docPath, 'utf8');
const scenarioIds = [...doc.matchAll(/^### (S\d{2}) — /gm)].map((match) => match[1]);
const uniqueScenarioIds = [...new Set(scenarioIds)];
const missing = [];

if (uniqueScenarioIds.length < minScenarioCount) {
  missing.push(`at least ${minScenarioCount} Given/When/Then scenarios`);
}

for (const id of uniqueScenarioIds) {
  const section = sectionFor(doc, id);
  for (const label of ['**Given**', '**When**', '**Then**', '**Command**', '**Expected evidence**']) {
    if (!section.includes(label)) missing.push(`${id} ${label}`);
  }
}

for (const phrase of requiredCoverage) {
  if (!doc.includes(phrase)) missing.push(`coverage phrase: ${phrase}`);
}

for (const command of requiredCommands) {
  if (!doc.includes(command)) missing.push(`command: ${command}`);
}

for (const noGo of noGos) {
  if (!doc.includes(noGo)) missing.push(`explicit v0 no-go: ${noGo}`);
}
for (const statement of requiredNoGoStatements) {
  if (!doc.includes(statement)) missing.push(`negative no-go context: ${statement}`);
}

for (const claim of forbiddenPositiveClaims) {
  if (doc.toLowerCase().includes(claim.toLowerCase())) {
    missing.push(`remove unsupported positive claim: ${claim}`);
  }
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
if (packageJson.scripts?.['test:simulation-qa'] !== 'node scripts/run-simulation-qa.mjs') {
  missing.push('package script test:simulation-qa');
}

for (const path of [docPath, 'scripts/run-simulation-qa.mjs']) {
  if (!existsSync(path)) missing.push(`file exists: ${path}`);
}

if (missing.length > 0) {
  fail(`Simulation QA harness incomplete:\n${missing.map((item) => `- ${item}`).join('\n')}`);
}

const report = {
  verdict: 'PASS',
  docPath,
  scenarioCount: uniqueScenarioIds.length,
  scenarios: uniqueScenarioIds,
  coverage: requiredCoverage,
  primaryCommands: requiredCommands,
  interpretation: 'offline deterministic fixture QA only; not real LLM/OCR/server/DB/DID evaluation'
};

console.log(JSON.stringify(report, null, 2));
console.log('ClaimGate simulation QA harness PASS');

function sectionFor(source, scenarioId) {
  const start = source.indexOf(`### ${scenarioId} — `);
  if (start === -1) return '';
  const next = source.indexOf('\n### S', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
