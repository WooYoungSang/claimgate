#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_INPUTS = Object.freeze({
  preflightPath: 'docs/demo/mofa-oda-video-preflight.md',
  runbookPath: 'docs/demo/mofa-oda-3-minute-runbook.md',
  storyboardPath: 'docs/demo/mofa-oda-submission-video-storyboard.md',
  packagePath: 'package.json',
  evidenceBundlePath: 'artifacts/submission/2026-mofa-ai/claim-evidence-bundle.json',
});

const requiredPreflightPhrases = Object.freeze([
  '# ClaimGate MOFA ODA Video Preflight',
  'NVIDIA GeForce RTX 4090',
  'CLAIMGATE_LOCAL_LLM_MODEL=gemma4:12b pnpm demo:ai:gemma',
  'provider=ollama',
  'model=gemma4:12b',
  'aiAuthority=candidate-only',
  'Evidence Pack JSON',
  'Report Markdown',
  'hosted LLM/LLM-as-judge',
  'No AI mock product path',
  'actualRecording remains pending until operator evidence exists',
]);

const runtimeEvidence = Object.freeze([
  'nvidia-smi --query-gpu=name,memory.total,memory.free,driver_version --format=csv,noheader',
  'CLAIMGATE_LOCAL_LLM_MODEL=gemma4:12b pnpm demo:ai:gemma',
  'pnpm demo',
  'pnpm test:submission-evidence',
]);

const forbiddenVideoFacingPhrases = Object.freeze([
  'demo:ai:mock',
  'mock demo',
  '후보 주장 제안 모의 실행',
]);

const currentBoundary = 'live OpenAPI, hosted LLM/LLM-as-judge, OCR, 서버·DB·auth, production accuracy는 FUTURE / No-Go다. RTX 4090 Local Gemma는 후보 추출 전용 경로다.';

export function validateVideoPreflight({ preflight, runbook, storyboard, packageJson, evidenceBundle }) {
  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };

  for (const phrase of requiredPreflightPhrases) {
    check(preflight.includes(phrase), `video preflight missing: ${phrase}`);
  }
  for (const command of runtimeEvidence) {
    check(preflight.includes(command), `video preflight missing real Local Gemma command evidence: ${command}`);
  }

  const videoFacingText = [preflight, runbook, storyboard].join('\n---\n');
  for (const phrase of forbiddenVideoFacingPhrases) {
    check(!videoFacingText.includes(phrase), `video-facing copy contains mock or simulation wording: ${phrase}`);
  }

  check(runbook.includes('RTX 4090 Local Gemma'), 'runbook must name RTX 4090 Local Gemma as the real local candidate path');
  check(runbook.includes('후보를 제안할 뿐 최종 판정 권한이 없다'), 'runbook must keep Local Gemma candidate-only authority wording');
  check(storyboard.includes('RTX 4090 Local Gemma는 후보 추출 전용 경로다'), 'storyboard must keep Local Gemma candidate-only product boundary');
  check(storyboard.includes('hosted LLM/LLM-as-judge'), 'storyboard must keep hosted LLM/LLM-as-judge No-Go boundary');

  const scripts = packageJson?.scripts ?? {};
  check(typeof scripts['demo:ai:gemma'] === 'string', 'package.json must expose demo:ai:gemma');
  check(scripts['demo:ai:gemma']?.includes('CLAIMGATE_LOCAL_LLM_PROVIDER=ollama'), 'demo:ai:gemma must force ollama provider');
  check(scripts['demo:ai:gemma']?.includes('gemma4:12b'), 'demo:ai:gemma must default to gemma4:12b');
  check(!Object.prototype.hasOwnProperty.call(scripts, 'demo:ai:mock'), 'package.json must not expose demo:ai:mock');
  check(scripts['test:video-preflight'] === 'node --test scripts/validate-video-preflight.test.mjs && node scripts/validate-video-preflight.mjs', 'package.json must expose test:video-preflight');

  check(evidenceBundle?.video?.actualRecording === 'pending', 'video must remain pending until operator evidence exists');
  check(evidenceBundle?.video?.rehearsalsCompleted === 0, 'rehearsals must remain 0 until measured by operator');
  const videoClaim = evidenceBundle?.claims?.find((claim) => claim.id === 'claim-three-minute-video');
  check(videoClaim?.status === 'pending', 'claim-three-minute-video must remain pending until actual recording evidence exists');
  const futureClaim = evidenceBundle?.claims?.find((claim) => claim.id === 'claim-future-boundaries');
  check(futureClaim?.statement === currentBoundary, 'future boundary claim must match Local Gemma / hosted LLM No-Go wording');
  check(evidenceBundle?.requiredNoGo?.includes('hosted-llm'), 'requiredNoGo must include hosted-llm');
  check(evidenceBundle?.requiredNoGo?.includes('llm-as-judge'), 'requiredNoGo must include llm-as-judge');

  return Object.freeze({
    ok: errors.length === 0,
    errors,
    summary: Object.freeze({
      requiredRuntimeEvidenceCount: runtimeEvidence.length,
      videoStatus: evidenceBundle?.video?.actualRecording ?? 'missing',
      model: 'gemma4:12b',
      provider: 'ollama',
      aiAuthority: 'candidate-only',
    }),
  });
}

export async function validateVideoPreflightFiles(paths = DEFAULT_INPUTS) {
  const [preflight, runbook, storyboard, packageText, evidenceText] = await Promise.all([
    readFile(paths.preflightPath, 'utf8'),
    readFile(paths.runbookPath, 'utf8'),
    readFile(paths.storyboardPath, 'utf8'),
    readFile(paths.packagePath, 'utf8'),
    readFile(paths.evidenceBundlePath, 'utf8'),
  ]);
  return validateVideoPreflight({
    preflight,
    runbook,
    storyboard,
    packageJson: JSON.parse(packageText),
    evidenceBundle: JSON.parse(evidenceText),
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const result = await validateVideoPreflightFiles();
  process.stdout.write(JSON.stringify({ status: result.ok ? 'PASS' : 'FAIL', ...result }, null, 2) + '\n');
  if (!result.ok) process.exitCode = 1;
}
