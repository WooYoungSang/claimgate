import type { DomainPack, DomainRiskRule } from '@claimgate/core/domain-pack';

const budgetVarianceRule: DomainRiskRule = {
  id: 'civic.budget-variance',
  description: 'AI 값과 출처 근거 값이 다른 시민 예산 주장을 표시합니다.',
  evaluate(input) {
    const matches = input.claim.aiValue === input.claim.sourceValue;
    return {
      level: matches ? 'green' : 'red',
      recommendedState: matches ? 'needs-evidence' : 'conflict',
      trace: [
        {
          ruleId: 'civic.budget-variance',
          level: matches ? 'green' : 'red',
          message: matches ? 'AI 값이 시민 예산 출처 행과 일치합니다.' : 'AI 값이 시민 예산 출처 행과 다릅니다.',
          evidenceRef: `${input.claim.anchor.sourceId}:${input.fixtureId ?? input.claim.id}`
        }
      ]
    };
  }
};

export const civicDataPack: DomainPack = {
  id: 'civic-data',
  packageName: '@claimgate/pack-civic-data',
  displayName: '시민 예산 데이터 팩',
  version: '0.0.0',
  description: '공공 예산 주장을 위한 고정 예시 데이터 우선 시민 재정 팩입니다.',
  labels: {
    claimSingular: '예산 주장',
    claimPlural: '예산 주장',
    reviewerNoun: '시민 예산 검토자',
    sourceNoun: '공공 예산 장부'
  },
  entityTypes: [
    { id: 'municipality', label: '지방자치단체' },
    { id: 'budget-line', label: '예산 항목' }
  ],
  anchorKinds: ['dataset-row', 'web-link'],
  riskRules: [budgetVarianceRule],
  reportTemplates: [
    { id: 'civic-review-summary', title: '시민 예산 검토 요약', sections: ['예산 주장', '출처 행', '검토자 조치'] }
  ],
  fixtures: [
    {
      id: 'civic-budget-mismatch',
      title: '예산 금액 불일치',
      source: { id: 'civic-budget-fy2026', kind: 'csv', title: '2026 회계연도 도시 예산 CSV', locator: 'fixture://civic/budget.csv' },
      claim: {
        id: 'civic-claim-001',
        text: '공원 부서 예산은 1,200만 달러입니다.',
        subject: '공원 부서',
        entityType: 'budget-line',
        aiValue: 12,
        sourceValue: 10,
        unit: '백만 달러',
        period: 'FY2026',
        anchor: { kind: 'dataset-row', sourceId: 'civic-budget-fy2026', dataset: 'civic-budget-fy2026', row: 4, column: 'amount_usd_m' }
      },
      expected: { ruleId: 'civic.budget-variance', level: 'red', recommendedState: 'conflict' }
    }
  ]
};
