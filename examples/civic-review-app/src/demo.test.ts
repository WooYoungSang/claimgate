import { describe, expect, it } from 'vitest';
import {
  buildEvidenceExport,
  buildReviewQueue,
  appendReviewRecord,
  createReviewRecord,
  coerceCorrectionValue,
  defaultPackId,
  formatDemo,
  reviewDecisionState,
  runDemo
} from './demo.js';

describe('example DomainPack composition', () => {
  it('defaults the public MOFA hostname to the MOFA ODA pack', () => {
    expect(defaultPackId('mofa.warvis.org')).toBe('mofa-oda');
    expect(defaultPackId('localhost')).toBe('civic-data');
  });

  it('can swap between three domain packs without changing core or UI', () => {
    const civic = runDemo('civic-data');
    const health = runDemo('health-data');
    const mofaOda = runDemo('mofa-oda');

    expect(civic.packId).toBe('civic-data');
    expect(health.packId).toBe('health-data');
    expect(mofaOda.packId).toBe('mofa-oda');
    expect(civic.riskLevel).toBe('red');
    expect(health.riskLevel).toBe('yellow');
    expect(mofaOda.riskLevel).toBe('red');
    expect(civic.claimLabel).not.toBe(health.claimLabel);
    expect(mofaOda.claimLabel).not.toBe(civic.claimLabel);
    expect(mofaOda.fixtureId).toBe('mofa-country-safety-mismatch');
  });

  it('prints deterministic pack-specific output', () => {
    expect(formatDemo(runDemo('civic-data'))).toContain('시민 예산 검토 요약');
    expect(formatDemo(runDemo('health-data'))).toContain('보건 통계 검토 요약');
    expect(formatDemo(runDemo('mofa-oda'))).toContain('외교부 ODA 주장 검토 요약');
  });

  it('tells the MOFA ODA public-data review story through reviewed projections', () => {
    const output = formatDemo(runDemo('mofa-oda'));

    expect(output).toContain('팩: 외교부 ODA 공공데이터 팩 (mofa-oda)');
    expect(output).toContain('고정 예시 데이터: mofa-country-safety-mismatch');
    expect(output).toContain('mofa.country-safety-mismatch => 위험/충돌');
    expect(output).toContain('출처 근거: mofa-country-safety-information');
    expect(output).toContain('검토자 판정: 정정 완료');
    expect(output).toContain('근거 묶음 항목: 1');
    expect(output).toContain('보고서: 외교부 ODA 주장 검토 요약');
    expect(output).toContain('그래프 노드:');
    expect(output).toContain('근거 묶음이 검증·정정된 주장 1건을 보고서와 그래프에 투영합니다.');
    expect(output).toContain('오프라인 결정론적 데모가 완료되었습니다.');
  });

  it('tells the judges-first correction to Evidence Pack story', () => {
    const civic = runDemo('civic-data');
    const output = formatDemo(civic);

    expect(civic.storyTitle).toBe('잘못된 AI 주장 → 위험 대기열 → 검토자 정정 → 근거 묶음');
    expect(civic.aiBoundary).toBe('AI는 후보만 제안하고 결정론적 규칙과 사람 검토자가 판정했습니다.');
    expect(civic.sourceAnchorId).toContain('civic-budget-fy2026');
    expect(civic.reviewerDecision).toBe('corrected');
    expect(civic.evidenceItemCount).toBe(1);
    expect(civic.graphNodeCount).toBeGreaterThanOrEqual(3);
    expect(civic.reportIncludesCorrection).toBe(true);
    expect(output).toContain('이야기: 잘못된 AI 주장 → 위험 대기열 → 검토자 정정 → 근거 묶음');
    expect(output).toContain('AI 경계: AI는 후보만 제안하고 결정론적 규칙과 사람 검토자가 판정했습니다.');
    expect(output).toContain('근거 묶음 항목: 1');
    expect(output).toContain('그래프 노드:');
  });

  it('builds a synchronized three-claim MOFA ODA review queue', () => {
    const queue = buildReviewQueue('mofa-oda');

    expect(queue).toHaveLength(3);
    expect(queue.map((item) => item.riskLevel)).toEqual(['red', 'yellow', 'green']);
    expect(queue.map((item) => item.ruleId)).toEqual([
      'mofa.country-safety-mismatch',
      'koica.project-period-or-country-mismatch',
      'oda.term-definition-match'
    ]);
    expect(queue[0]).toMatchObject({
      fixtureId: 'mofa-country-safety-mismatch',
      sourceTitle: '외교부_국가별 안전정보',
      sourceBoundary: '공공데이터 출처 이력 · 실시간 OpenAPI 호출 없음',
      initialDecision: 'pending',
      evidenceEligible: false
    });
    expect(queue[1]?.initialDecision).toBe('pending');
    expect(queue[2]?.initialDecision).toBe('pending');
  });

  it('keeps Evidence Pack eligibility controlled by the reviewer decision', () => {
    expect(reviewDecisionState('pending')).toEqual({ label: '검토 대기', evidenceEligible: false });
    expect(reviewDecisionState('verified')).toEqual({ label: '검증 완료', evidenceEligible: true });
    expect(reviewDecisionState('corrected')).toEqual({ label: '정정 완료', evidenceEligible: true });
    expect(reviewDecisionState('rejected')).toEqual({ label: '기각', evidenceEligible: false });
  });

  it('requires a reviewer-authored value and reason for corrections', () => {
    expect(() => createReviewRecord('corrected', { correctedValue: '', reason: 'source mismatch' })).toThrow(
      '정정 판정에는 정정 값이 필요합니다.'
    );
    expect(() => createReviewRecord('corrected', { correctedValue: 'anchored value', reason: '' })).toThrow(
      '정정 판정에는 검토 사유가 필요합니다.'
    );

    expect(createReviewRecord('corrected', { correctedValue: 'anchored value', reason: 'MOFA source conflict' })).toEqual({
      decision: 'corrected',
      correctedValue: 'anchored value',
      reason: 'MOFA source conflict',
      reviewerId: '데모-검토자',
      decidedAt: '2026-07-08T00:00:00.000Z'
    });
  });

  it('exports only explicitly verified or corrected review records', () => {
    const queue = buildReviewQueue('mofa-oda');
    const records = {
      'mofa-country-safety-mismatch': createReviewRecord('corrected', {
        correctedValue: queue[0]!.sourceValue,
        reason: '외교부 국가별 안전정보와 충돌하여 근거값으로 정정'
      }),
      'koica-project-period-or-country-mismatch': createReviewRecord('rejected', { reason: '추가 확인 전 제외' }),
      'oda-term-definition-match': createReviewRecord('verified', { reason: 'ODA 용어사전 정의와 일치' })
    } as const;

    const exported = buildEvidenceExport('mofa-oda', records);

    expect(exported.itemCount).toBe(2);
    expect(exported.json).toContain('mofa-oda-claim-001');
    expect(exported.json).toContain('mofa-oda-claim-003');
    expect(exported.json).not.toContain('mofa-oda-claim-002');
    expect(exported.markdown).toContain('# 외교부 ODA 주장 검토 요약');
    expect(exported.markdown).toContain('외교부 국가별 안전정보와 충돌하여 근거값으로 정정');
    expect(exported.markdown).toContain('오프라인 · 결정론적 · 고정 예시 데이터 우선');
    expect(exported.markdown).toContain('투영 출처: 근거 묶음');
    expect(exported.markdown).toContain('검토자 판정: 정정 완료');
    expect(exported.markdown).not.toContain('Projection source: Evidence Pack');
    expect(exported.markdown).not.toContain('- Claim:');
  });

  it('allows a reviewer correction from a non-conflict risk disposition', () => {
    const queue = buildReviewQueue('health-data');
    const corrected = createReviewRecord('corrected', {
      correctedValue: queue[0]!.sourceValue,
      reason: '검토자가 고정 출처 값으로 정정 판정'
    });

    const exported = buildEvidenceExport('health-data', { [queue[0]!.fixtureId]: corrected });

    expect(exported.itemCount).toBe(1);
    expect(exported.json).toContain('health-claim-001');
    expect(exported.markdown).toContain('검토자가 고정 출처 값으로 정정 판정');
  });

  it('keeps terminal reviewer records append-only until reset', () => {
    const first = createReviewRecord('verified', { reason: 'source confirmed' });
    const records = appendReviewRecord({}, 'fixture-a', first);

    expect(records['fixture-a']).toBe(first);
    expect(() => appendReviewRecord(records, 'fixture-a', createReviewRecord('rejected', { reason: 'later overwrite' }))).toThrow(
      "고정 예시 데이터 'fixture-a'에는 이미 최종 검토 기록이 있습니다. 변경하려면 검토 실행을 초기화하세요."
    );
  });

  it('preserves numeric and boolean ClaimValue types in corrections', () => {
    expect(createReviewRecord('corrected', { correctedValue: 0, reason: 'zero is the anchored value' }).correctedValue).toBe(0);
    expect(createReviewRecord('corrected', { correctedValue: false, reason: 'false is the anchored value' }).correctedValue).toBe(false);
    expect(coerceCorrectionValue('10', 10)).toBe(10);
    expect(coerceCorrectionValue('false', false)).toBe(false);
    expect(coerceCorrectionValue('010', '010')).toBe('010');
  });

});
