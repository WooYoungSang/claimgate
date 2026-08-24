import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('builds persistent local RAG index artifact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claimgate-rag-'));
  const out = join(dir, 'rag-index.json');
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/build-local-rag-index.ts', '--out', out], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  const index = JSON.parse(readFileSync(out, 'utf8'));

  assert.equal(index.id, 'mofa-oda-local-rag-index');
  assert.equal(index.retrievalMode, 'repo-local persistent sparse-vector RAG index; no external vector DB');
  assert.ok(index.chunks.length >= 3);
});

test('builds candidate-only Gemma tuning JSONL and passes preflight with mocked RTX 4090', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claimgate-tuning-'));
  const out = join(dir, 'tuning.jsonl');
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/build-gemma-tuning-dataset.ts', '--out', out], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  const jsonl = readFileSync(out, 'utf8');
  assert.match(jsonl, /"candidates"/);
  assert.doesNotMatch(jsonl, /reviewerDecision|riskLevel|riskScore|"verified"/);

  const preflight = execFileSync(
    'pnpm',
    [
      'exec',
      'tsx',
      'scripts/gemma-tuning-preflight.ts',
      '--dataset',
      out,
      '--nvidia-smi-output',
      'NVIDIA GeForce RTX 4090, 24564, 22000, 565.57.01',
      '--skip-python-deps',
      '--base-model',
      'google/gemma-4-12B-it'
    ],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
  const report = JSON.parse(preflight);
  assert.equal(report.status, 'PASS');
  assert.equal(report.gpuReady, true);
  assert.equal(report.datasetReady, true);
  assert.equal(report.pythonDepsReady, true);
  assert.equal(report.trainingReady, 'ready');
});


test('strict Gemma tuning preflight fails closed when free VRAM is too low', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claimgate-tuning-vram-'));
  const out = join(dir, 'tuning.jsonl');
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/build-gemma-tuning-dataset.ts', '--out', out], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.throws(
    () =>
      execFileSync(
        'pnpm',
        [
          'exec',
          'tsx',
          'scripts/gemma-tuning-preflight.ts',
          '--dataset',
          out,
          '--nvidia-smi-output',
          'NVIDIA GeForce RTX 4090, 24564, 1200, 565.57.01',
          '--skip-python-deps',
          '--base-model',
          'google/gemma-4-12B-it'
        ],
        { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      ),
    /Command failed/
  );
});


test('validates candidate-only LoRA artifact without production authority overclaim', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claimgate-lora-artifact-'));
  const adapter = join(dir, 'adapter');
  const dataset = join(dir, 'tuning.jsonl');
  const out = join(dir, 'eval.json');
  mkdirSync(adapter, { recursive: true });
  writeFileSync(join(adapter, 'adapter_config.json'), '{}\n');
  writeFileSync(join(adapter, 'adapter_model.safetensors'), 'fake adapter bytes');
  writeFileSync(
    join(adapter, 'training-report.json'),
    JSON.stringify({
      status: 'TEST_TRAINED',
      authority: 'candidate-only',
      productionQuality: false,
      maxSteps: 2,
      baseModel: 'google/gemma-4-12B-it',
      notes: 'does not grant verification authority'
    })
  );
  writeFileSync(
    dataset,
    JSON.stringify({
      id: 'example-1',
      input: 'AI 답변: ODA는 정부 원조입니다.',
      output: { candidates: [{ id: 'ai-candidate-1', text: 'ODA는 정부 원조입니다.', state: 'extracted' }] }
    }) + '\n'
  );

  const result = execFileSync(
    'node',
    ['scripts/validate-gemma-lora-artifact.mjs', '--adapter', adapter, '--dataset', dataset, '--out', out],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
  const report = JSON.parse(result);
  assert.equal(report.status, 'PASS');
  assert.equal(report.authority, 'candidate-only');
  assert.equal(report.productionQuality, false);
  assert.equal(JSON.parse(readFileSync(out, 'utf8')).status, 'PASS');
});

test('LoRA artifact validation rejects authority-shaped tuning examples', () => {
  const dir = mkdtempSync(join(tmpdir(), 'claimgate-lora-artifact-leak-'));
  const adapter = join(dir, 'adapter');
  const dataset = join(dir, 'tuning.jsonl');
  mkdirSync(adapter, { recursive: true });
  writeFileSync(join(adapter, 'adapter_config.json'), '{}\n');
  writeFileSync(join(adapter, 'adapter_model.safetensors'), 'fake adapter bytes');
  writeFileSync(
    join(adapter, 'training-report.json'),
    JSON.stringify({ status: 'TEST_TRAINED', authority: 'candidate-only', productionQuality: false, notes: 'does not grant verification authority' })
  );
  writeFileSync(
    dataset,
    JSON.stringify({
      id: 'bad-example',
      output: { candidates: [{ id: 'ai-candidate-1', text: '검증됨', state: 'verified', reviewerDecision: 'verified' }] }
    }) + '\n'
  );

  assert.throws(
    () =>
      execFileSync('node', ['scripts/validate-gemma-lora-artifact.mjs', '--adapter', adapter, '--dataset', dataset], {
        cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
      }),
    /Command failed/
  );
});
