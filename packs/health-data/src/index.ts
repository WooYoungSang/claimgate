import type { DomainPack, DomainRiskRule } from '@claimgate/core/domain-pack';

const staleRateRule: DomainRiskRule = {
  id: 'health.stale-rate-period',
  description: 'Flags health rate claims when the source period is older than the expected reporting year.',
  evaluate(input) {
    const isStale = input.claim.period !== '2026';
    return {
      level: isStale ? 'yellow' : 'green',
      recommendedState: 'needs-evidence',
      trace: [
        {
          ruleId: 'health.stale-rate-period',
          level: isStale ? 'yellow' : 'green',
          message: isStale ? 'Health statistic period is stale for the requested report year.' : 'Health statistic period matches the requested report year.',
          evidenceRef: `${input.claim.anchor.sourceId}:${input.fixtureId ?? input.claim.id}`
        }
      ]
    };
  }
};

export const healthDataPack: DomainPack = {
  id: 'health-data',
  packageName: '@claimgate/pack-health-data',
  displayName: 'Health Data Pack',
  version: '0.0.0',
  description: 'Fixture-first health statistics pack for public rate claims.',
  labels: {
    claimSingular: 'health statistic claim',
    claimPlural: 'health statistic claims',
    reviewerNoun: 'health reviewer',
    sourceNoun: 'public health bulletin'
  },
  entityTypes: [
    { id: 'agency', label: 'Health agency' },
    { id: 'indicator', label: 'Health indicator' }
  ],
  anchorKinds: ['pdf-page', 'text-span'],
  riskRules: [staleRateRule],
  reportTemplates: [
    { id: 'health-review-summary', title: 'Health Statistic Review Summary', sections: ['Indicator claim', 'Bulletin excerpt', 'Reviewer action'] }
  ],
  fixtures: [
    {
      id: 'health-rate-stale-period',
      title: 'Stale rate period',
      source: { id: 'health-bulletin-2025', title: 'Public health bulletin PDF', uri: 'fixture://health/bulletin.pdf' },
      claim: {
        id: 'health-claim-001',
        text: 'The vaccination rate is 94 percent in 2026.',
        subject: 'Vaccination Rate',
        entityType: 'indicator',
        aiValue: 94,
        sourceValue: 94,
        unit: 'percent',
        period: '2025',
        anchor: { kind: 'pdf-page', sourceId: 'health-bulletin-2025', page: 12, quote: 'Vaccination rate: 94% (2025)' }
      },
      expected: { ruleId: 'health.stale-rate-period', level: 'yellow', recommendedState: 'needs-evidence' }
    }
  ]
};
