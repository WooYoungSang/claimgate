import type { DomainPack, DomainRiskRule } from '@claimgate/core/domain-pack';

const budgetVarianceRule: DomainRiskRule = {
  id: 'civic.budget-variance',
  description: 'Flags civic budget claims when the AI value differs from the anchored source value.',
  evaluate(input) {
    const matches = input.claim.aiValue === input.claim.sourceValue;
    return {
      level: matches ? 'green' : 'red',
      recommendedState: matches ? 'needs-evidence' : 'conflict',
      trace: [
        {
          ruleId: 'civic.budget-variance',
          level: matches ? 'green' : 'red',
          message: matches ? 'AI value matches the civic source row.' : 'AI value differs from the civic source row.',
          evidenceRef: `${input.claim.anchor.sourceId}:${input.fixtureId ?? input.claim.id}`
        }
      ]
    };
  }
};

export const civicDataPack: DomainPack = {
  id: 'civic-data',
  packageName: '@claimgate/pack-civic-data',
  displayName: 'Civic Data Pack',
  version: '0.0.0',
  description: 'Fixture-first civic finance pack for public budget claims.',
  labels: {
    claimSingular: 'budget claim',
    claimPlural: 'budget claims',
    reviewerNoun: 'civic reviewer',
    sourceNoun: 'public ledger'
  },
  entityTypes: [
    { id: 'municipality', label: 'Municipality' },
    { id: 'budget-line', label: 'Budget line' }
  ],
  anchorKinds: ['csv-row', 'web-link'],
  riskRules: [budgetVarianceRule],
  reportTemplates: [
    { id: 'civic-review-summary', title: 'Civic Budget Review Summary', sections: ['Budget claim', 'Source row', 'Reviewer action'] }
  ],
  fixtures: [
    {
      id: 'civic-budget-mismatch',
      title: 'Budget amount mismatch',
      source: { id: 'civic-budget-fy2026', title: 'FY2026 city budget CSV', uri: 'fixture://civic/budget.csv' },
      claim: {
        id: 'civic-claim-001',
        text: 'The parks budget is 12 million USD.',
        subject: 'Parks Department',
        entityType: 'budget-line',
        aiValue: 12,
        sourceValue: 10,
        unit: 'USD millions',
        period: 'FY2026',
        anchor: { kind: 'csv-row', sourceId: 'civic-budget-fy2026', row: 4, column: 'amount_usd_m' }
      },
      expected: { ruleId: 'civic.budget-variance', level: 'red', recommendedState: 'conflict' }
    }
  ]
};
