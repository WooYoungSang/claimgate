import { describe, expect, it } from 'vitest';
import type { DomainPack, DomainRiskRule } from '../src/domain-pack.js';

const mismatchRule: DomainRiskRule = {
  id: 'demo.value-mismatch',
  description: 'flags a fixture mismatch',
  evaluate(input) {
    return {
      level: input.claim.aiValue === input.claim.sourceValue ? 'green' : 'red',
      recommendedState: input.claim.aiValue === input.claim.sourceValue ? 'needs-evidence' : 'conflict',
      trace: [{ ruleId: 'demo.value-mismatch', level: input.claim.aiValue === input.claim.sourceValue ? 'green' : 'red', message: 'deterministic comparison' }]
    };
  }
};

const pack: DomainPack = {
  id: 'demo-domain',
  packageName: '@claimgate/pack-demo-domain',
  displayName: 'Demo Domain',
  version: '0.0.0',
  description: 'test pack',
  labels: { claimSingular: 'finding', claimPlural: 'findings', reviewerNoun: 'reviewer' },
  entityTypes: [{ id: 'agency', label: 'Agency' }],
  anchorKinds: ['csv-row'],
  riskRules: [mismatchRule],
  reportTemplates: [{ id: 'summary', title: 'Summary', sections: ['review'] }],
  fixtures: [
    {
      id: 'demo-fixture',
      title: 'Demo fixture',
      source: { id: 'demo-source', title: 'Demo CSV' },
      claim: {
        id: 'demo-claim',
        text: 'The agency budget is 10.',
        subject: 'agency',
        aiValue: 11,
        sourceValue: 10,
        anchor: { kind: 'csv-row', sourceId: 'demo-source', row: 2, column: 'budget' }
      },
      expected: { ruleId: 'demo.value-mismatch', level: 'red', recommendedState: 'conflict' }
    }
  ]
};

describe('DomainPack contract', () => {
  it('keeps domain judgment in pack-owned rules with deterministic traces', () => {
    const decision = pack.riskRules[0]?.evaluate({ packId: pack.id, fixtureId: pack.fixtures[0]?.id, claim: pack.fixtures[0]!.claim });

    expect(decision).toMatchObject({ level: 'red', recommendedState: 'conflict' });
    expect(decision?.trace).toEqual([{ ruleId: 'demo.value-mismatch', level: 'red', message: 'deterministic comparison' }]);
  });

  it('requires a reusable pack shape: metadata, anchors, entities, rules, templates, fixtures', () => {
    expect(pack.packageName).toBe('@claimgate/pack-demo-domain');
    expect(pack.anchorKinds).toEqual(['csv-row']);
    expect(pack.entityTypes.map((entity) => entity.id)).toEqual(['agency']);
    expect(pack.reportTemplates.map((template) => template.id)).toEqual(['summary']);
    expect(pack.fixtures).toHaveLength(1);
  });
});
