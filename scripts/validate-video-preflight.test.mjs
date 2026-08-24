import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  validateVideoPreflight,
  validateVideoPreflightFiles,
} from './validate-video-preflight.mjs';

const loadInputs = async () => ({
  preflight: await readFile('docs/demo/mofa-oda-video-preflight.md', 'utf8'),
  runbook: await readFile('docs/demo/mofa-oda-3-minute-runbook.md', 'utf8'),
  storyboard: await readFile('docs/demo/mofa-oda-submission-video-storyboard.md', 'utf8'),
  packageJson: JSON.parse(await readFile('package.json', 'utf8')),
  evidenceBundle: JSON.parse(await readFile('artifacts/submission/2026-mofa-ai/claim-evidence-bundle.json', 'utf8')),
});

test('current video preflight contract passes', async () => {
  const result = await validateVideoPreflightFiles();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.summary.requiredRuntimeEvidenceCount, 4);
  assert.equal(result.summary.videoStatus, 'pending');
});

test('rejects missing real RTX 4090 Local Gemma command evidence', async () => {
  const inputs = await loadInputs();
  inputs.preflight = inputs.preflight.replace('CLAIMGATE_LOCAL_LLM_MODEL=gemma4:12b pnpm demo:ai:gemma', 'pnpm demo:ai:fixture');
  const result = validateVideoPreflight(inputs);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /real Local Gemma command/);
});

test('rejects mock demo wording on video-facing surfaces', async () => {
  const inputs = await loadInputs();
  inputs.runbook = inputs.runbook.replace('후보를 제안할 뿐', '후보 주장 제안 모의 실행을 할 뿐');
  const result = validateVideoPreflight(inputs);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /mock or simulation wording/);
});

test('rejects AI authority overclaims in preflight copy', async () => {
  const inputs = await loadInputs();
  inputs.preflight = inputs.preflight.replace('aiAuthority=candidate-only', 'aiAuthority=verified');
  const result = validateVideoPreflight(inputs);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /aiAuthority=candidate-only/);
});

test('rejects marking recording complete without operator evidence', async () => {
  const inputs = await loadInputs();
  inputs.evidenceBundle.video.actualRecording = 'complete';
  const result = validateVideoPreflight(inputs);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /video must remain pending/);
});
