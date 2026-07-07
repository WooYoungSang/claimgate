import { describe, expect, it } from 'vitest';
import type { DomainPack } from '@claimgate/core/domain-pack';
import { assertDomainPackConformance, runDomainPackConformance } from '../src/index.js';

const inlinePack: DomainPack = {
  id: 'inline-demo',
  packageName: '@claimgate/pack-inline-demo',
  displayName: 'Inline Demo Pack',
  version: '0.0.0',
  description: 'Inline pack for conformance kit tests.',
  labels: { claimSingular: 'inline claim', claimPlural: 'inline claims', reviewerNoun: 'reviewer' },
  entityTypes: [{ id: 'indicator', label: 'Indicator' }],
  anchorKinds: ['text-span'],
  riskRules: [
    {
      id: 'inline.match',
      description: 'Checks equal values.',
      evaluate(input) {
        const matched = input.claim.aiValue === input.claim.sourceValue;
        return {
          level: matched ? 'green' : 'red',
          recommendedState: matched ? 'needs-evidence' : 'conflict',
          trace: [{ ruleId: 'inline.match', level: matched ? 'green' : 'red', message: 'stable equality rule' }]
        };
      }
    }
  ],
  reportTemplates: [{ id: 'inline-summary', title: 'Inline Summary', sections: ['claim', 'source'] }],
  fixtures: [
    {
      id: 'inline-green',
      title: 'Inline green fixture',
      source: { id: 'inline-source', title: 'Inline source' },
      claim: {
        id: 'inline-claim',
        text: 'The inline value is 4.',
        entityType: 'indicator',
        aiValue: 4,
        sourceValue: 4,
        anchor: { kind: 'text-span', sourceId: 'inline-source', startOffset: 0, endOffset: 10 }
      },
      expected: { ruleId: 'inline.match', level: 'green', recommendedState: 'needs-evidence' }
    }
  ]
};

describe('@claimgate/conformance', () => {
  it('passes a complete deterministic DomainPack', () => {
    const report = runDomainPackConformance(inlinePack);

    expect(report.passed).toBe(true);
    expect(report.failures).toEqual([]);
    expect(report.fixtureResults).toHaveLength(1);
    expect(() => assertDomainPackConformance(inlinePack)).not.toThrow();
  });

  it('reports incomplete packs instead of silently passing', () => {
    const report = runDomainPackConformance({ ...inlinePack, fixtures: [] });

    expect(report.passed).toBe(false);
    expect(report.failures).toContain('fixtures must not be empty');
  });


  it('reports fixtures whose anchor sourceId does not match the fixture source id', () => {
    const report = runDomainPackConformance({
      ...inlinePack,
      fixtures: [
        {
          ...inlinePack.fixtures[0]!,
          claim: {
            ...inlinePack.fixtures[0]!.claim,
            anchor: { ...inlinePack.fixtures[0]!.claim.anchor, sourceId: 'different-source' }
          }
        }
      ]
    });

    expect(report.passed).toBe(false);
    expect(report.failures).toContain(
      'fixture inline-green anchor sourceId different-source does not match source id inline-source'
    );
  });

  it('reports runtime recommendedState values outside the domain review states', () => {
    const invalidStatePack = {
      ...inlinePack,
      riskRules: [
        {
          ...inlinePack.riskRules[0]!,
          evaluate() {
            return {
              level: 'green',
              recommendedState: 'verified',
              trace: [{ ruleId: 'inline.match', level: 'green', message: 'terminal states are invalid here' }]
            };
          }
        }
      ],
      fixtures: [
        {
          ...inlinePack.fixtures[0]!,
          expected: { ...inlinePack.fixtures[0]!.expected, recommendedState: 'verified' }
        }
      ]
    } as unknown as DomainPack;

    const report = runDomainPackConformance(invalidStatePack);

    expect(report.passed).toBe(false);
    expect(report.failures).toContain('fixture inline-green expected invalid recommendedState verified');
    expect(report.failures).toContain('fixture inline-green produced invalid recommendedState verified');
  });
});
