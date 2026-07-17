#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const defaultRoot = resolve(dirname(modulePath), '..');

const sourcePaths = Object.freeze({
  main: 'examples/civic-review-app/src/main.tsx',
  guided: 'examples/civic-review-app/src/guided-demo.ts',
  visual: 'examples/civic-review-app/src/visual-diff.ts',
  civic: 'packs/civic-data/src/index.ts',
  health: 'packs/health-data/src/index.ts',
  mofa: 'packs/mofa-oda/src/index.ts'
});

const labelContracts = Object.freeze([
  ['외교부 ODA 시제품', 'main'],
  ['가이드 데모 시작', 'guided'],
  ['오프라인 고정 예시 데이터', 'main'],
  ['AI 후보 제안기 · 제안 전용', 'main'],
  ['외교부 ODA 공공데이터 팩', 'mofa'],
  ['검토할 주장', 'main'],
  ['다음 단계', 'main'],
  ['AI 제안', 'main'],
  ['출처 근거', 'main'],
  ['값 불일치', 'visual'],
  ['공공데이터 출처 이력', 'main'],
  ['판정 규칙', 'main'],
  ['근거값으로 정정', 'main'],
  ['판정 사유', 'main'],
  ['판정 기록', 'main'],
  ['검토 결과', 'main'],
  ['근거 묶음 미리보기', 'main'],
  ['JSON 다운로드', 'main'],
  ['마크다운 다운로드', 'main'],
  ['가이드 완료', 'main'],
  ['오프라인 · 결정론적 · 고정 예시 데이터 우선', 'main'],
  ['투영 가능', 'main'],
  ['시민 예산 데이터 팩', 'civic'],
  ['보건 통계 데이터 팩', 'health']
]);

const decisionContracts = Object.freeze({
  rejected: Object.freeze({ roleClass: 'reject', label: '기각' }),
  corrected: Object.freeze({ roleClass: 'correct', label: '근거값으로 정정' }),
  verified: Object.freeze({ roleClass: 'verify', label: '검증 완료' })
});

const guidedStepContracts = Object.freeze([
  Object.freeze({ id: 'candidate', order: 1, target: 'review-queue' }),
  Object.freeze({ id: 'source-anchor', order: 2, target: 'source-comparison' }),
  Object.freeze({ id: 'human-review', order: 3, target: 'reviewer-decision' }),
  Object.freeze({ id: 'evidence-pack', order: 4, target: 'evidence-preview' })
]);

const orderedTimelineRows = Object.freeze([
  Object.freeze(['오프닝', '0–20초', '가이드 데모 시작']),
  Object.freeze(['1단계 · 후보 주장', '20–50초', '검토할 주장']),
  Object.freeze(['2단계 · 근거 비교', '50–85초', 'AI 제안']),
  Object.freeze(['3단계 · 사람 판정', '85–120초', '근거값으로 정정']),
  Object.freeze(['4단계 · 결과 투영', '120–160초', '근거 묶음 미리보기']),
  Object.freeze(['확장성과 종료', '160–180초', '외교부 ODA 공공데이터 팩'])
]);

const staleAliases = Object.freeze([
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
]);

const noGoTerms = Object.freeze([
  'offline / deterministic / fixture-first',
  'live OpenAPI',
  'real LLM',
  'OCR',
  '서버·DB·auth',
  'production accuracy'
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function jsxRenderedText(fragment) {
  return fragment
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^{}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasExactUiLiteral(source, label) {
  const escaped = escapeRegExp(label);
  const quotedLiteral = new RegExp("(['\"`])" + escaped + "\\1");
  const jsxText = new RegExp(`>\\s*${escaped}\\s*<`);
  return quotedLiteral.test(source) || jsxText.test(source);
}

function hasBacktickLiteral(markdown, label) {
  return markdown.indexOf(`\`${label}\``) >= 0;
}

function sectionBetween(markdown, heading, nextHeadingPrefix) {
  const start = markdown.indexOf(heading);
  if (start < 0) return '';
  const next = markdown.indexOf(`\n${nextHeadingPrefix}`, start + heading.length);
  return markdown.slice(start, next < 0 ? undefined : next);
}

function parseTableCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function parseMarkdownTable(markdown, expectedHeader) {
  const lines = markdown.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const header = parseTableCells(lines[index]);
    if (!header || header.length !== expectedHeader.length) continue;
    if (!header.every((cell, cellIndex) => cell === expectedHeader[cellIndex])) continue;

    const separator = parseTableCells(lines[index + 1] ?? '');
    if (!separator || separator.length !== header.length || !isSeparatorRow(separator)) return [];

    const rows = [];
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const cells = parseTableCells(lines[rowIndex]);
      if (!cells) break;
      if (cells.length === header.length && !isSeparatorRow(cells)) rows.push(cells);
    }
    return rows;
  }
  return [];
}

export function extractDecisionButtons(mainSource) {
  const buttons = {};
  const handler = /onClick=\{\(\)\s*=>\s*openDecision\('([^']+)'\)\}>([\s\S]*?)<\/button>/g;
  for (const match of mainSource.matchAll(handler)) {
    const [whole, decision, body] = match;
    const buttonStart = mainSource.lastIndexOf('<button', match.index);
    const block = mainSource.slice(buttonStart, (match.index ?? 0) + whole.length);
    const roleClass = ['reject', 'correct', 'verify'].find((role) => new RegExp(`['"][^'"]*\\b${role}\\b`).test(block));
    buttons[decision] = Object.freeze({ decision, roleClass, label: jsxRenderedText(body) });
  }
  return Object.freeze(buttons);
}

export function extractGuidedDemoSteps(guidedSource) {
  const declarationStart = guidedSource.indexOf('export const GUIDED_DEMO_STEPS');
  if (declarationStart < 0) return [];
  const declarationEnd = guidedSource.indexOf('\n]);', declarationStart);
  const declaration = guidedSource.slice(declarationStart, declarationEnd < 0 ? undefined : declarationEnd + 4);
  const steps = [];
  const objectPattern = /Object\.freeze\(\{([\s\S]*?)\}\)/g;
  for (const match of declaration.matchAll(objectPattern)) {
    const body = match[1];
    const id = body.match(/\bid:\s*'([^']+)'/)?.[1];
    const order = Number(body.match(/\border:\s*(\d+)/)?.[1]);
    const target = body.match(/\btarget:\s*'([^']+)'/)?.[1];
    if (id && Number.isInteger(order) && target) steps.push(Object.freeze({ id, order, target }));
  }
  return Object.freeze(steps);
}

export function loadDefaultInputs(root = defaultRoot) {
  const read = (path) => readFileSync(resolve(root, path), 'utf8');
  return Object.freeze({
    runbook: read('docs/demo/mofa-oda-3-minute-runbook.md'),
    sources: Object.freeze(Object.fromEntries(
      Object.entries(sourcePaths).map(([key, path]) => [key, read(path)])
    ))
  });
}

export function validateDemoRunbook({ runbook, sources }) {
  const failures = [];
  const check = (condition, message) => {
    if (!condition) failures.push(message);
  };

  for (const [label, sourceKey] of labelContracts) {
    check(hasExactUiLiteral(sources[sourceKey], label), `UI ${sourceKey}에서 정확한 문구를 찾지 못했습니다: ${label}`);
    check(hasBacktickLiteral(runbook, label), `런북에 실제 UI 문구가 백틱으로 명시되지 않았습니다: ${label}`);
  }

  const decisionButtons = extractDecisionButtons(sources.main);
  for (const [decision, expected] of Object.entries(decisionContracts)) {
    const actual = decisionButtons[decision];
    check(Boolean(actual), `판정 버튼 역할을 찾지 못했습니다: ${decision}`);
    check(actual?.roleClass === expected.roleClass, `${decision} 버튼 class는 ${expected.roleClass}여야 합니다: ${actual?.roleClass ?? 'missing'}`);
    check(actual?.label === expected.label, `${decision} 버튼 문구는 ${expected.label}이어야 합니다: ${actual?.label ?? 'missing'}`);
  }

  const guidedSteps = extractGuidedDemoSteps(sources.guided);
  check(guidedSteps.length === guidedStepContracts.length, `가이드 단계 수가 달라졌습니다: ${guidedSteps.length}`);
  for (const expected of guidedStepContracts) {
    const actual = guidedSteps.find((step) => step.id === expected.id);
    check(Boolean(actual), `가이드 단계를 찾지 못했습니다: ${expected.id}`);
    check(actual?.order === expected.order, `${expected.id} order는 ${expected.order}이어야 합니다: ${actual?.order ?? 'missing'}`);
    check(actual?.target === expected.target, `${expected.id} target은 ${expected.target}이어야 합니다: ${actual?.target ?? 'missing'}`);
  }

  for (const alias of staleAliases) {
    check(!hasBacktickLiteral(runbook, alias), `현재 UI에 없는 이전 조작명이 남았습니다: ${alias}`);
  }

  const timeline = sectionBetween(runbook, '## 1. 3분 타임라인', '## 2.');
  const timelineRows = parseMarkdownTable(timeline, ['구간', '시간', '화면 조작', '발표 멘트와 확인점']);
  check(timelineRows.length === orderedTimelineRows.length, `타임라인 행 수가 달라졌습니다: ${timelineRows.length}`);
  orderedTimelineRows.forEach(([stage, time, control], index) => {
    const row = timelineRows[index];
    check(row?.[0] === stage, `타임라인 ${index + 1}번째 구간은 ${stage}이어야 합니다: ${row?.[0] ?? 'missing'}`);
    check(row?.[1] === time, `${stage} 시간은 ${time}이어야 합니다: ${row?.[1] ?? 'missing'}`);
    check(row?.[2]?.includes(`\`${control}\``), `${stage} 조작에 실제 UI 문구가 없습니다: ${control}`);
  });

  const quickCue = sectionBetween(runbook, '## 한 페이지 퀵 큐', '## 리허설 기록');
  for (const timestamp of ['00:00', '00:20', '00:50', '01:25', '02:00', '02:15', '02:40', '03:00 STOP']) {
    check(quickCue.includes(`**${timestamp}**`), `퀵 큐 타임스탬프가 없습니다: ${timestamp}`);
  }

  for (const term of noGoTerms) check(runbook.includes(term), `시제품 No-Go/FUTURE 경계가 없습니다: ${term}`);

  const rehearsal = sectionBetween(runbook, '## 리허설 기록', '## __end__');
  const rehearsalRows = parseMarkdownTable(rehearsal, ['회차', '실측 시간', '화면 문구 일치', '예상 상태 일치', '결과']);
  for (const round of ['리허설 1', '리허설 2']) {
    const row = rehearsalRows.find((candidate) => candidate[0] === round);
    check(Boolean(row), `독립 ${round} 기록란이 없습니다.`);
    check(row?.[1] === '미측정' && row?.[4] === '미실시', `${round} 미실시 상태를 성공처럼 기록하면 안 됩니다.`);
  }
  check(runbook.includes('165–195초'), '3분 ±15초 허용 범위(165–195초)가 명시되지 않았습니다.');

  return Object.freeze({
    ok: failures.length === 0,
    failures: Object.freeze(failures),
    counts: Object.freeze({ labels: labelContracts.length, stages: orderedTimelineRows.length, decisions: Object.keys(decisionContracts).length, guidedSteps: guidedStepContracts.length })
  });
}

export function formatValidationResult(result) {
  if (!result.ok) {
    return [`demo-runbook-sync: ${result.failures.length}개 계약 실패`, ...result.failures.map((failure) => `- ${failure}`)].join('\n');
  }
  const { labels, stages, decisions, guidedSteps } = result.counts;
  return `demo-runbook-sync: ${labels}개 화면 문구, ${decisions}개 판정 버튼, ${guidedSteps}개 가이드 target, ${stages}개 단계, No-Go 및 2회 리허설 계약 OK`;
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  const result = validateDemoRunbook(loadDefaultInputs());
  const output = formatValidationResult(result);
  (result.ok ? console.log : console.error)(output);
  if (!result.ok) process.exitCode = 1;
}
