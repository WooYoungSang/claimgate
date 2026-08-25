import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildGemmaTuningJsonl, LOCAL_GEMMA_TUNING_DATASET_VERSION, type GemmaTuningDataset } from '@claimgate/ai-local';
import { mofaOdaPack } from '@claimgate/pack-mofa-oda';

const DEFAULT_OUT = 'artifacts/local-ai/gemma-candidate-tuning.jsonl';
const DEFAULT_HOLDOUT_OUT = 'artifacts/local-ai/gemma-candidate-holdout.jsonl';

type DatasetSplit = 'train' | 'holdout';

function buildExample(fixture: (typeof mofaOdaPack.fixtures)[number], split: DatasetSplit, variant: string, input: string) {
  return Object.freeze({
    id: `${fixture.id}-${split}-${variant}`,
    instruction:
      'Extract public-data candidate claims only. Return exactly one CandidateClaim JSON object and stop. Do not verify truth, score risk, attach final anchors, make reviewer decisions, or project evidence.',
    input,
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
      sourceId: fixture.source.id,
      split,
      variant,
      aiAuthority: 'candidate-only'
    })
  });
}

function sourceExcerpt(fixture: (typeof mofaOdaPack.fixtures)[number]): string {
  return fixture.claim.anchor.excerpt ?? fixture.claim.anchor.quote ?? fixture.claim.sourceValue ?? '';
}

export function buildMofaGemmaTuningSplits(): Readonly<{ train: GemmaTuningDataset; holdout: GemmaTuningDataset }> {
  const trainExamples = mofaOdaPack.fixtures.flatMap((fixture) => [
    buildExample(
      fixture,
      'train',
      'record',
      [`자료 제목: ${fixture.source.title}`, `자료 위치: ${fixture.source.locator}`, `AI 답변: ${fixture.claim.text}`, `검색 근거: ${sourceExcerpt(fixture)}`].join('\n')
    ),
    buildExample(
      fixture,
      'train',
      'compact',
      [`AI 생성 문장: ${fixture.claim.text}`, `공공데이터명: ${fixture.source.title}`, `회수 문맥: ${sourceExcerpt(fixture)}`].join('\n')
    )
  ]);
  const holdoutExamples = mofaOdaPack.fixtures.map((fixture) =>
    buildExample(
      fixture,
      'holdout',
      'review-queue',
      [`후보 추출 대상`, fixture.claim.text, `검색된 출처`, `${fixture.source.title}: ${sourceExcerpt(fixture)}`, `출처 식별자: ${fixture.source.id}`].join('\n')
    )
  );
  return Object.freeze({
    train: Object.freeze({ version: LOCAL_GEMMA_TUNING_DATASET_VERSION, examples: Object.freeze(trainExamples) }),
    holdout: Object.freeze({ version: LOCAL_GEMMA_TUNING_DATASET_VERSION, examples: Object.freeze(holdoutExamples) })
  });
}

export function buildMofaGemmaTuningDataset(): GemmaTuningDataset {
  return buildMofaGemmaTuningSplits().train;
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

function parseHoldoutOut(argv: readonly string[]): string {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--holdout-out') return argv[++index] ?? DEFAULT_HOLDOUT_OUT;
    if (arg.startsWith('--holdout-out=')) return arg.slice('--holdout-out='.length);
  }
  return DEFAULT_HOLDOUT_OUT;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = resolve(parseOut(process.argv.slice(2)));
  const holdoutOut = resolve(parseHoldoutOut(process.argv.slice(2)));
  const splits = buildMofaGemmaTuningSplits();
  mkdirSync(dirname(out), { recursive: true });
  mkdirSync(dirname(holdoutOut), { recursive: true });
  writeFileSync(out, buildGemmaTuningJsonl(splits.train));
  writeFileSync(holdoutOut, buildGemmaTuningJsonl(splits.holdout));
  console.log(`Gemma candidate-only training dataset written: ${out}`);
  console.log(`Gemma candidate-only holdout dataset written: ${holdoutOut}`);
}
