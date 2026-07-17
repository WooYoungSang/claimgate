#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const runbook = read('docs/demo/mofa-oda-3-minute-runbook.md');
const screenCopy = [
  read('examples/civic-review-app/src/main.tsx'),
  read('examples/civic-review-app/src/guided-demo.ts'),
  read('examples/civic-review-app/src/visual-diff.ts'),
  read('packs/civic-data/src/index.ts'),
  read('packs/health-data/src/index.ts'),
  read('packs/mofa-oda/src/index.ts')
].join('\n');

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const exactScreenLabels = [
  '외교부 ODA 시제품',
  '가이드 데모 시작',
  '오프라인 고정 예시 데이터',
  'AI 후보 제안기 · 제안 전용',
  '외교부 ODA 공공데이터 팩',
  '검토할 주장',
  '다음 단계',
  'AI 제안',
  '출처 근거',
  '값 불일치',
  '공공데이터 출처 이력',
  '판정 규칙',
  '근거값으로 정정',
  '판정 사유',
  '판정 기록',
  '검토 결과',
  '근거 묶음 미리보기',
  'JSON 다운로드',
  '마크다운 다운로드',
  '가이드 완료',
  '오프라인 · 결정론적 · 고정 예시 데이터 우선',
  '투영 가능',
  '시민 예산 데이터 팩',
  '보건 통계 데이터 팩'
];

for (const label of exactScreenLabels) {
  check(screenCopy.includes(label), `UI 기준 문구를 소스에서 찾지 못했습니다: ${label}`);
  check(runbook.includes(`\`${label}\``), `런북에 실제 UI 문구가 백틱으로 명시되지 않았습니다: ${label}`);
}

const staleAliases = [
  'ClaimGate · MOFA ODA prototype',
  'Offline fixture',
  'AI Curator · fixture proposal only',
  'MOFA ODA Public Data Pack',
  'Source Anchor',
  'Public-data provenance',
  'Review outcome',
  'Evidence Pack 미리보기',
  'Markdown 다운로드',
  'Offline · deterministic · fixture-first',
  'Static preview',
  'DomainPack civic / health / MOFA'
];

for (const alias of staleAliases) {
  check(!runbook.includes(`\`${alias}\``), `현재 UI에 없는 이전 조작명이 남았습니다: ${alias}`);
}

const timeline = runbook.match(/## 1\. 3분 타임라인[\s\S]*?(?=\n## 2\.)/)?.[0] ?? '';
const orderedRows = [
  ['오프닝', '0–20초', '가이드 데모 시작'],
  ['1단계 · 후보 주장', '20–50초', '검토할 주장'],
  ['2단계 · 근거 비교', '50–85초', 'AI 제안'],
  ['3단계 · 사람 판정', '85–120초', '근거값으로 정정'],
  ['4단계 · 결과 투영', '120–160초', '근거 묶음 미리보기'],
  ['확장성과 종료', '160–180초', '외교부 ODA 공공데이터 팩']
];

let previousIndex = -1;
for (const [stage, time, control] of orderedRows) {
  const row = timeline.split('\n').find((line) => line.startsWith(`| ${stage} |`));
  const matches = Boolean(row?.includes(`| ${time} |`) && row.includes(`\`${control}\``));
  check(matches, `타임라인 행이 실제 UI 조작명과 일치하지 않습니다: ${stage} / ${control}`);
  if (matches) {
    const index = timeline.indexOf(row);
    check(index > previousIndex, `타임라인 단계 순서가 뒤바뀌었습니다: ${stage}`);
    previousIndex = index;
  }
}

const quickCue = runbook.match(/## 한 페이지 퀵 큐[\s\S]*$/)?.[0] ?? '';
for (const timestamp of ['00:00', '00:20', '00:50', '01:25', '02:00', '02:15', '02:40', '03:00 STOP']) {
  check(quickCue.includes(`**${timestamp}**`), `퀵 큐 타임스탬프가 없습니다: ${timestamp}`);
}

const noGoTerms = ['offline / deterministic / fixture-first', 'live OpenAPI', 'real LLM', 'OCR', '서버·DB·auth', 'production accuracy'];
for (const term of noGoTerms) {
  check(runbook.includes(term), `시제품 No-Go/FUTURE 경계가 없습니다: ${term}`);
}

check(runbook.includes('| 리허설 1 |') && runbook.includes('| 리허설 2 |'), '독립 리허설 2회 기록란이 없습니다.');
check(runbook.includes('165–195초'), '3분 ±15초 허용 범위(165–195초)가 명시되지 않았습니다.');

if (failures.length > 0) {
  console.error(`demo-runbook-sync: ${failures.length}개 계약 실패`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`demo-runbook-sync: ${exactScreenLabels.length}개 화면 문구, ${orderedRows.length}개 단계, No-Go 및 2회 리허설 계약 OK`);
