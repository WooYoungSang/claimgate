import type { DomainPack, DomainRiskRule } from '@claimgate/core/domain-pack';

const staleRateRule: DomainRiskRule = {
  id: 'health.stale-rate-period',
  description: '출처 기간이 예상 보고 연도보다 오래된 보건 통계 비율 주장을 표시합니다.',
  evaluate(input) {
    const isStale = input.claim.period !== '2026';
    return {
      level: isStale ? 'yellow' : 'green',
      recommendedState: 'needs-evidence',
      trace: [
        {
          ruleId: 'health.stale-rate-period',
          level: isStale ? 'yellow' : 'green',
          message: isStale ? '보건 통계 기간이 요청된 보고 연도보다 오래되었습니다.' : '보건 통계 기간이 요청된 보고 연도와 일치합니다.',
          evidenceRef: `${input.claim.anchor.sourceId}:${input.fixtureId ?? input.claim.id}`
        }
      ]
    };
  }
};

export const healthDataPack: DomainPack = {
  id: 'health-data',
  packageName: '@claimgate/pack-health-data',
  displayName: '보건 통계 데이터 팩',
  version: '0.0.0',
  description: '공공 비율 주장을 위한 고정 예시 데이터 우선 보건 통계 팩입니다.',
  labels: {
    claimSingular: '보건 통계 주장',
    claimPlural: '보건 통계 주장',
    reviewerNoun: '보건 통계 검토자',
    sourceNoun: '공공 보건 소식지'
  },
  entityTypes: [
    { id: 'agency', label: '보건 기관' },
    { id: 'indicator', label: '보건 지표' }
  ],
  anchorKinds: ['pdf-page', 'text-span'],
  riskRules: [staleRateRule],
  reportTemplates: [
    { id: 'health-review-summary', title: '보건 통계 검토 요약', sections: ['지표 주장', '소식지 발췌', '검토자 조치'] }
  ],
  fixtures: [
    {
      id: 'health-rate-stale-period',
      title: '오래된 비율 통계 기간',
      source: { id: 'health-bulletin-2025', kind: 'pdf', title: '공공 보건 소식지 PDF', locator: 'fixture://health/bulletin.pdf' },
      claim: {
        id: 'health-claim-001',
        text: '2026년 예방접종률은 94퍼센트입니다.',
        subject: '예방접종률',
        entityType: 'indicator',
        aiValue: 94,
        sourceValue: 94,
        unit: '퍼센트',
        period: '2025',
        anchor: { kind: 'pdf-page', sourceId: 'health-bulletin-2025', page: 12, quote: '예방접종률: 94% (2025년)' }
      },
      expected: { ruleId: 'health.stale-rate-period', level: 'yellow', recommendedState: 'needs-evidence' }
    }
  ]
};
