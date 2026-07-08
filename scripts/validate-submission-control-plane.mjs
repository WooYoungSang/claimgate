import { readFileSync, existsSync } from 'node:fs';

const docPath = 'docs/competition-submission.md';
const required = [
  '# ClaimGate OSS Contest Submission Control Plane',
  '## Contest deadline and control checklist',
  '## Submission artifact inventory',
  '## Evidence gate matrix',
  '## Final go/no-go workflow',
  '## Private-until-ready operating notes',
  'No external submission',
  'Do not publish',
  'No Anchor, No Claim',
  'AI Curator, Not Judge',
  'deterministic risk',
  'Evidence Pack First',
  'verified/corrected-only projection',
];

if (!existsSync(docPath)) {
  console.error(`Missing required submission control plane: ${docPath}`);
  process.exit(1);
}

const doc = readFileSync(docPath, 'utf8');
const missing = required.filter((needle) => !doc.includes(needle));

const checklistRows = (doc.match(/^\| .+ \| .+ \| .+ \| .+ \|$/gm) ?? []).length;
if (checklistRows < 10) {
  missing.push('at least 10 markdown table rows for checklist/evidence inventory');
}

if (missing.length > 0) {
  console.error('Submission control plane is incomplete. Missing:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Submission control plane validated: ${docPath}`);
