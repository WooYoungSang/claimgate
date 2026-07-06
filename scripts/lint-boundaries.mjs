import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const forbiddenCoreImports = [
  '@claimgate/ui',
  '@claimgate/pack-',
  'react',
  'react-dom',
  'zustand',
  'vite',
  '@vitejs/'
];
const forbiddenRuntimeTerms = ['express', 'fastify', 'typeorm', 'prisma', 'mongoose', 'passport'];
const findings = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) paths.push(path);
  }
  return paths;
}

function importsFrom(source) {
  return [...source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'";]+\s+from\s+)?["']([^"']+)["']/g)].map((m) => m[1]);
}

for (const file of await walk(join(root, 'packages/core/src'))) {
  const source = await readFile(file, 'utf8');
  for (const specifier of importsFrom(source)) {
    if (forbiddenCoreImports.some((forbidden) => specifier === forbidden || specifier.startsWith(forbidden))) {
      findings.push(`${file}: core must stay framework/domain independent; forbidden import '${specifier}'`);
    }
  }
}

for (const manifest of ['package.json']) {
  const source = await readFile(join(root, manifest), 'utf8');
  for (const term of forbiddenRuntimeTerms) {
    if (source.includes(term)) findings.push(`${manifest}: v0 scaffold must not add server/DB/auth dependency '${term}'`);
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}
console.log('lint-boundaries: ClaimGate scaffold boundaries OK');
