import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractDecisionButtons,
  extractGuidedDemoSteps,
  loadDefaultInputs,
  validateDemoRunbook
} from './validate-demo-runbook.mjs';

const decisionMutations = Object.freeze([
  Object.freeze({ decision: 'rejected', expected: '기각', mutated: '반려' }),
  Object.freeze({ decision: 'corrected', expected: '근거값으로 정정', mutated: '정정' }),
  Object.freeze({ decision: 'verified', expected: '검증 완료', mutated: '검증' })
]);

const guidedStepContracts = Object.freeze([
  Object.freeze({ id: 'candidate', order: 1, target: 'review-queue' }),
  Object.freeze({ id: 'source-anchor', order: 2, target: 'source-comparison' }),
  Object.freeze({ id: 'human-review', order: 3, target: 'reviewer-decision' }),
  Object.freeze({ id: 'evidence-pack', order: 4, target: 'evidence-preview' })
]);

function mutateDecisionButtonLabel(source, decision, expected, mutated) {
  const handler = `openDecision('${decision}')`;
  const handlerIndex = source.indexOf(handler);
  assert.notEqual(handlerIndex, -1, `${decision} 버튼 핸들러가 있어야 한다`);
  const blockStart = source.lastIndexOf('<button', handlerIndex);
  const blockEnd = source.indexOf('</button>', handlerIndex) + '</button>'.length;
  assert.ok(blockStart >= 0 && blockEnd >= '</button>'.length, `${decision} 버튼 범위를 찾아야 한다`);

  const block = source.slice(blockStart, blockEnd);
  const mutatedBlock = block.replace(expected, mutated);
  assert.notEqual(mutatedBlock, block, `${decision} 레이블 mutation 전제가 실제 소스와 일치해야 한다`);
  return source.slice(0, blockStart) + mutatedBlock + source.slice(blockEnd);
}

function guidedDeclarationRange(source) {
  const start = source.indexOf('export const GUIDED_DEMO_STEPS');
  const endMarker = '\n]);';
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end >= 0, '가이드 단계 선언 범위를 찾아야 한다');
  return Object.freeze({ start, end: end + endMarker.length });
}

function mutateGuidedStepField(source, step, field) {
  const range = guidedDeclarationRange(source);
  const declaration = source.slice(range.start, range.end);
  const idLiteral = `id: '${step.id}'`;
  const idIndex = declaration.indexOf(idLiteral);
  assert.notEqual(idIndex, -1, `${step.id} 단계가 있어야 한다`);
  const blockStart = declaration.lastIndexOf('Object.freeze({', idIndex);
  const blockEnd = declaration.indexOf('})', idIndex) + 2;
  assert.ok(blockStart >= 0 && blockEnd >= 2, `${step.id} 단계 객체 범위를 찾아야 한다`);

  const block = declaration.slice(blockStart, blockEnd);
  const mutation = field === 'order'
    ? { expected: `order: ${step.order}`, mutated: `order: ${step.order + 10}` }
    : { expected: `${field}: '${step[field]}'`, mutated: `${field}: '${step[field]}-mutated'` };
  const mutatedBlock = block.replace(mutation.expected, mutation.mutated);
  assert.notEqual(mutatedBlock, block, `${step.id}.${field} mutation 전제가 실제 소스와 일치해야 한다`);
  const mutatedDeclaration = declaration.slice(0, blockStart) + mutatedBlock + declaration.slice(blockEnd);
  return source.slice(0, range.start) + mutatedDeclaration + source.slice(range.end);
}

function reorderFirstTwoGuidedStepObjects(source) {
  const range = guidedDeclarationRange(source);
  const declaration = source.slice(range.start, range.end);
  const objects = [...declaration.matchAll(/Object\.freeze\(\{[\s\S]*?\}\)/g)].map((match) => match[0]);
  assert.ok(objects.length >= 2, '재정렬할 가이드 단계 객체가 둘 이상이어야 한다');
  const sentinel = '__CLAIMGATE_FIRST_GUIDED_STEP__';
  const mutatedDeclaration = declaration
    .replace(objects[0], sentinel)
    .replace(objects[1], objects[0])
    .replace(sentinel, objects[1]);
  assert.notEqual(mutatedDeclaration, declaration, '전체 객체 재정렬 mutation이 적용되어야 한다');
  return source.slice(0, range.start) + mutatedDeclaration + source.slice(range.end);
}

test('현재 런북과 UI 구조 계약이 통과한다', () => {
  const result = validateDemoRunbook(loadDefaultInputs());
  assert.equal(result.ok, true, result.failures.join('\n'));
});

for (const { decision, expected, mutated } of decisionMutations) {
  test(`${decision} 버튼 문구 mutation을 역할별 구조 검증이 차단한다`, () => {
    const input = loadDefaultInputs();
    const mutatedMain = mutateDecisionButtonLabel(input.sources.main, decision, expected, mutated);
    const buttons = extractDecisionButtons(mutatedMain);
    assert.equal(buttons[decision]?.label, mutated);

    const result = validateDemoRunbook({
      ...input,
      sources: { ...input.sources, main: mutatedMain }
    });
    assert.equal(result.ok, false);
    assert.match(result.failures.join('\n'), new RegExp(`${decision}.*${expected}|${expected}.*${decision}`));
  });
}

test('가이드 단계 전체 객체 재정렬을 배열 순서 계약이 차단한다', () => {
  const input = loadDefaultInputs();
  const mutatedGuided = reorderFirstTwoGuidedStepObjects(input.sources.guided);
  const steps = extractGuidedDemoSteps(mutatedGuided);
  assert.deepEqual(steps.slice(0, 2).map((step) => step.id), ['source-anchor', 'candidate']);

  const result = validateDemoRunbook({
    ...input,
    sources: { ...input.sources, guided: mutatedGuided }
  });
  assert.equal(result.ok, false, '단계 객체 순서가 바뀌면 id를 find해 통과시키면 안 된다');
  assert.match(result.failures.join('\n'), /가이드 1번째|가이드 2번째/);
});

for (const step of guidedStepContracts) {
  for (const field of ['id', 'order', 'target']) {
    test(`${step.id}.${field} mutation을 인덱스별 구조 검증이 차단한다`, () => {
      const input = loadDefaultInputs();
      const mutatedGuided = mutateGuidedStepField(input.sources.guided, step, field);
      const steps = extractGuidedDemoSteps(mutatedGuided);
      const mutatedStep = steps[step.order - 1];
      if (field === 'order') assert.equal(mutatedStep?.order, step.order + 10);
      else assert.equal(mutatedStep?.[field], `${step[field]}-mutated`);

      const result = validateDemoRunbook({
        ...input,
        sources: { ...input.sources, guided: mutatedGuided }
      });
      assert.equal(result.ok, false);
      assert.match(result.failures.join('\n'), new RegExp(`가이드 ${step.order}번째|${step.id}`));
    });
  }
}

test('Markdown 표의 파이프 주변 공백 변화는 허용한다', () => {
  const input = loadDefaultInputs();
  const compactTables = input.runbook
    .split('\n')
    .map((line) => line.trim().startsWith('|') ? line.trim().replace(/\s*\|\s*/g, '|') : line)
    .join('\n');

  const result = validateDemoRunbook({ ...input, runbook: compactTables });
  assert.equal(result.ok, true, result.failures.join('\n'));
});
