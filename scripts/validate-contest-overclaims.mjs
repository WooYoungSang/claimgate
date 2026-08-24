#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const files = {
  readme: 'README.md',
  verification: 'docs/verification-matrix.md',
  demo: 'docs/demo-script.md',
  control: 'docs/competition-submission.md',
  matrix: 'docs/submission/2026-mofa-ai/claim-evidence-matrix.md',
  proposal: 'docs/submission/2026-mofa-ai/claimgate-oda-product-service-proposal.md',
  civicReadme: 'packs/civic-data/README.md',
  healthReadme: 'packs/health-data/README.md',
  mofaReadme: 'packs/mofa-oda/README.md'
};

const docs = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, readFileSync(path, 'utf8')])
);

const errors = [];

function requireIncludes(key, needle) {
  if (!docs[key].includes(needle)) {
    errors.push(`${files[key]} must include: ${needle}`);
  }
}

function forbidIncludes(key, needle) {
  if (docs[key].includes(needle)) {
    errors.push(`${files[key]} must not include stale/overclaim text: ${needle}`);
  }
}

requireIncludes('readme', 'local Ollama/Gemma command is candidate-only');
requireIncludes('readme', 'repo-local persistent sparse-vector index');
requireIncludes('readme', 'no committed production fine-tuned model artifact');
requireIncludes('readme', 'packs/mofa-oda/');

requireIncludes('verification', 'Local Ollama/Gemma guard');
requireIncludes('verification', 'Local sparse-vector RAG boundary');
requireIncludes('verification', 'civic, health, and MOFA ODA packs');
requireIncludes('verification', 'every declared riskRule must be exercised by at least one fixture');

requireIncludes('demo', 'repo-local persistent sparse-vector index, not an external vector DB or live public-data call');
requireIncludes('demo', 'candidate-only tuning dataset generator, strict RTX 4090/free-VRAM/Python-dependency preflight, and optional LoRA training entrypoint');
requireIncludes('demo', '`pnpm demo:ai:gemma` has been run on the RTX 4090 node');

requireIncludes('control', 'RTX 4090 local Ollama/Gemma extraction path is candidate-only');
requireIncludes('control', 'Civic, health, and MOFA ODA packs prove reuse');

requireIncludes('matrix', 'local RTX 4090 Ollama/Gemma candidate-only extraction');
requireIncludes('matrix', 'production vector RAG, fine-tuned model artifacts');

requireIncludes('proposal', 'civic·health·MOFA ODA 세 개의 오프라인 예시 팩 구현');
requireIncludes('proposal', '현재 저장소의 ODA 시제품은 공공데이터 URL을 provenance metadata로 보존');
requireIncludes('proposal', 'KF·한·아프리카재단 데이터 결합은 향후 DomainPack 확장 범위');

requireIncludes('civicReadme', 'Deterministic civic public-data DomainPack');
requireIncludes('healthReadme', 'Deterministic health public-data DomainPack');
requireIncludes('mofaReadme', 'offline fixture-only');

forbidIncludes('proposal', '두 개의 예시 팩');
forbidIncludes('proposal', 'ODA DomainPack과 발표 데모를 개발 중');
forbidIncludes('proposal', 'OpenAPI는 읽기 전용 어댑터로 수집');
forbidIncludes('proposal', 'KOICA·KF·한·아프리카재단 데이터와 결합해');
forbidIncludes('matrix', 'A real LLM is not implemented');
forbidIncludes('verification', 'run two packs');
forbidIncludes('verification', 'civic/health packs');
forbidIncludes('readme', 'demo:ai:mock');
forbidIncludes('demo', 'demo:ai:mock');
forbidIncludes('civicReadme', 'Later Bets add');
forbidIncludes('healthReadme', 'Later Bets add');

if (errors.length > 0) {
  console.error('Contest overclaim guard failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Contest overclaim guard passed.');
