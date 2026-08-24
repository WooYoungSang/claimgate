import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildGemmaTuningJsonl, LOCAL_GEMMA_TUNING_DATASET_VERSION, type GemmaTuningDataset } from '@claimgate/ai-local';
import { mofaOdaPack } from '@claimgate/pack-mofa-oda';

const DEFAULT_OUT = 'artifacts/local-ai/gemma-candidate-tuning.jsonl';

export function buildMofaGemmaTuningDataset(): GemmaTuningDataset {
  return Object.freeze({
    version: LOCAL_GEMMA_TUNING_DATASET_VERSION,
    examples: Object.freeze(
      mofaOdaPack.fixtures.map((fixture) =>
        Object.freeze({
          id: `${fixture.id}-candidate-only`,
          instruction:
            'Extract public-data candidate claims only. Return CandidateClaim[] JSON. Do not verify truth, score risk, attach final anchors, make reviewer decisions, or project evidence.',
          input: [
            `자료 제목: ${fixture.source.title}`,
            `자료 위치: ${fixture.source.locator}`,
            `AI 답변: ${fixture.claim.text}`,
            `검색 근거: ${fixture.claim.anchor.excerpt ?? fixture.claim.anchor.quote ?? fixture.claim.sourceValue ?? ''}`
          ].join('\n'),
          output: Object.freeze({
            candidates: Object.freeze([
              Object.freeze({
                id: `ai-candidate-${fixture.id}`,
                text: fixture.claim.text,
                state: 'extracted' as const,
                ...(fixture.claim.subject ? { subject: fixture.claim.subject } : {}),
                ...(fixture.claim.aiValue !== undefined ? { aiValue: fixture.claim.aiValue } : {})
              })
            ])
          }),
          metadata: Object.freeze({
            packId: mofaOdaPack.id,
            fixtureId: fixture.id,
            aiAuthority: 'candidate-only'
          })
        })
      )
    )
  });
}

export function buildMofaGemmaTuningJsonl(): string {
  return buildGemmaTuningJsonl(buildMofaGemmaTuningDataset());
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
  writeFileSync(out, buildMofaGemmaTuningJsonl());
  console.log(`Gemma candidate-only tuning dataset written: ${out}`);
}
