import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildPersistentRagIndex, ragIndexToJson, type RagDocument } from '@claimgate/ai-local';
import { mofaOdaPack } from '@claimgate/pack-mofa-oda';

const DEFAULT_OUT = 'artifacts/local-ai/mofa-oda-rag-index.json';
const fixedCreatedAt = '2026-08-17T00:00:00.000Z';

export function mofaOdaRagDocuments(): readonly RagDocument[] {
  return Object.freeze(
    mofaOdaPack.fixtures.map((fixture) =>
      Object.freeze({
        id: fixture.source.id,
        title: fixture.source.title,
        text: [
          fixture.title,
          fixture.claim.text,
          `AI 값: ${String(fixture.claim.aiValue ?? '')}`,
          `출처 값: ${String(fixture.claim.sourceValue ?? '')}`,
          fixture.claim.anchor.excerpt ?? fixture.claim.anchor.quote ?? '',
          fixture.source.locator ?? '',
          Object.entries(fixture.source.metadata ?? {})
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join('\n')
        ]
          .filter(Boolean)
          .join('\n')
      })
    )
  );
}

export function buildMofaOdaRagIndexJson(): string {
  return ragIndexToJson(
    buildPersistentRagIndex({
      id: 'mofa-oda-local-rag-index',
      documents: mofaOdaRagDocuments(),
      createdAt: fixedCreatedAt
    })
  );
}

function parseOut(argv: readonly string[]): string {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--out') return argv[++index] ?? DEFAULT_OUT;
    if (arg.startsWith('--out=')) return arg.slice('--out='.length);
  }
  return DEFAULT_OUT;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = resolve(parseOut(process.argv.slice(2)));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${buildMofaOdaRagIndexJson()}\n`);
  console.log(`local RAG index written: ${out}`);
}
