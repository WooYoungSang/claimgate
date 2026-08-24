#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const bannedTerms = ['de'+'vos', 'Shape'+'Ops', 'warvis'+'-mcp', 'warvis'+'_mcp', 'mcp__'+'warvis'];
const banned = bannedTerms.map((term) => new RegExp(term, 'i'));
const read = (path) => readFileSync(join(root, path), 'utf8');
const requireIncludes = (path, needle) => {
  const text = read(path);
  if (!text.includes(needle)) failures.push(`${path}: missing ${JSON.stringify(needle)}`);
};
const requireNoBanned = (path) => {
  const text = read(path);
  for (const pattern of banned) {
    if (pattern.test(text)) failures.push(`${path}: contains banned legacy reference ${pattern}`);
  }
};

for (const [path, needle] of [
  ['AGENTS.md', 'kbctl is the context SSOT'],
  ['AGENTS.md', 'Active local target model: `gpt-5.6-sol`'],
  ['.codex/AGENTS.md', 'Context/design SSOT: `./kbctl`'],
  ['.codex/config.toml', 'model = "gpt-5.6-sol"'],
  ['.mcp.json', 'codex'],
  ['.codex/hooks/stop.sh', './kbctl'],
]) requireIncludes(path, needle);

for (const path of [
  'AGENTS.md', 'CLAUDE.md', '.codex/AGENTS.md', '.codex/config.toml', '.mcp.json',
  '.codex/TOOL_CATALOG.md', '.codex/MCP_TOOL_CATALOG.md', '.codex/TOOL_CAVEATS.md',
  'governance/knowledge/claimgate-kb.json', 'package.json',
]) requireNoBanned(path);

for (const file of readdirSync(join(root, '.codex/agents')).filter((name) => name.endsWith('.toml'))) {
  const path = `.codex/agents/${file}`;
  const text = read(path);
  for (const field of ['name =', 'description =', 'developer_instructions =']) {
    if (!text.includes(field)) failures.push(`${path}: missing ${field}`);
  }
  requireNoBanned(path);
}

for (const skill of readdirSync(join(root, '.agents/skills'))) {
  const path = `.agents/skills/${skill}/SKILL.md`;
  let text;
  try { text = read(path); } catch { failures.push(`${path}: missing SKILL.md`); continue; }
  if (!/^---\n[\s\S]*?\n---/m.test(text)) failures.push(`${path}: missing frontmatter`);
  if (!/^name:/m.test(text)) failures.push(`${path}: missing name metadata`);
  if (!/^description:/m.test(text)) failures.push(`${path}: missing description metadata`);
  requireNoBanned(path);
}

for (const path of ['.codex/hooks/pretooluse-guard.sh', '.codex/hooks/post-edit-validate.sh', '.codex/hooks/stop.sh']) {
  const mode = statSync(join(root, path)).mode;
  if ((mode & 0o111) === 0) failures.push(`${path}: not executable`);
  requireNoBanned(path);
}

if (failures.length) {
  console.error('Harness GPT-5.6 audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Harness GPT-5.6 kbctl-only audit passed.');
