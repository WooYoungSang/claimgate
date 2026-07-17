import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractDecisionButtons,
  extractGuidedDemoSteps,
  loadDefaultInputs,
  validateDemoRunbook
} from './validate-demo-runbook.mjs';

test('현재 런북과 UI 구조 계약이 통과한다', () => {
  const result = validateDemoRunbook(loadDefaultInputs());
  assert.equal(result.ok, true, result.failures.join('\n'));
});

test('corrected 버튼 문구 mutation을 역할별 구조 검증이 차단한다', () => {
  const input = loadDefaultInputs();
  const mutatedMain = input.sources.main.replace(
    "openDecision('corrected')}>근거값으로 정정</button>",
    "openDecision('corrected')}>정정</button>"
  );
  assert.notEqual(mutatedMain, input.sources.main, 'mutation 전제가 실제 소스와 일치해야 한다');

  const buttons = extractDecisionButtons(mutatedMain);
  assert.equal(buttons.corrected?.label, '정정');

  const result = validateDemoRunbook({
    ...input,
    sources: { ...input.sources, main: mutatedMain }
  });
  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /corrected.*근거값으로 정정|근거값으로 정정.*corrected/);
});

test('가이드 source-comparison/reviewer-decision target swap을 차단한다', () => {
  const input = loadDefaultInputs();
  const placeholder = "target: '__target-swap__'";
  const mutatedGuided = input.sources.guided
    .replace("target: 'source-comparison'", placeholder)
    .replace("target: 'reviewer-decision'", "target: 'source-comparison'")
    .replace(placeholder, "target: 'reviewer-decision'");
  assert.notEqual(mutatedGuided, input.sources.guided, 'mutation 전제가 실제 소스와 일치해야 한다');

  const steps = extractGuidedDemoSteps(mutatedGuided);
  assert.equal(steps.find((step) => step.id === 'source-anchor')?.target, 'reviewer-decision');
  assert.equal(steps.find((step) => step.id === 'human-review')?.target, 'source-comparison');

  const result = validateDemoRunbook({
    ...input,
    sources: { ...input.sources, guided: mutatedGuided }
  });
  assert.equal(result.ok, false);
  assert.match(result.failures.join('\n'), /source-anchor|human-review/);
});

test('Markdown 표의 파이프 주변 공백 변화는 허용한다', () => {
  const input = loadDefaultInputs();
  const compactTables = input.runbook
    .split('\n')
    .map((line) => line.trim().startsWith('|') ? line.trim().replace(/\s*\|\s*/g, '|') : line)
    .join('\n');

  const result = validateDemoRunbook({ ...input, runbook: compactTables });
  assert.equal(result.ok, true, result.failures.join('\n'));
});
