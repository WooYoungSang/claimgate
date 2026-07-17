import { describe, expect, it } from 'vitest';
import { mofaOdaPack, mofaOdaPresentation } from '../src/index.js';

describe('MOFA ODA Korean scenario presentation', () => {
  it('presents deterministic Korean red, yellow, and green judge scenarios', () => {
    expect(mofaOdaPresentation.scenarios.map((scenario) => scenario.riskLevel)).toEqual(['red', 'yellow', 'green']);
    expect(mofaOdaPresentation.scenarios.map((scenario) => scenario.riskLabelKo)).toEqual([
      '즉시 검토',
      '추가 확인',
      '표본 검토'
    ]);

    for (const scenario of mofaOdaPresentation.scenarios) {
      expect(scenario.headlineKo).toMatch(/[가-힣]/u);
      expect(scenario.claimLabelKo).toMatch(/[가-힣]/u);
      expect(scenario.reviewerPromptKo).toMatch(/[가-힣]/u);
    }
  });

  it('keeps rule identities and Source Anchors grounded in the canonical pack fixtures', () => {
    for (const fixture of mofaOdaPack.fixtures) {
      const scenario = mofaOdaPresentation.scenarios.find((candidate) => candidate.fixtureId === fixture.id);

      expect(scenario).toBeDefined();
      expect(scenario?.ruleId).toBe(fixture.expected.ruleId);
      expect(scenario?.sourceSnapshot.source).toBe(fixture.source);
      expect(scenario?.sourceSnapshot.anchor).toBe(fixture.claim.anchor);
      expect(scenario?.sourceSnapshot.excerpt).toBe(fixture.claim.anchor.excerpt);
      expect(scenario?.sourceSnapshot.boundary).toBe(fixture.source.metadata?.sourceBoundary);
    }
  });

  it('explicitly presents the foreign-ministry country safety source without live access', () => {
    const redScenario = mofaOdaPresentation.scenarios[0];

    expect(redScenario).toMatchObject({
      fixtureId: 'mofa-country-safety-mismatch',
      ruleId: 'mofa.country-safety-mismatch',
      sourceSnapshot: {
        title: '외교부_국가별 안전정보',
        accessMode: 'offline-fixture-only'
      }
    });
    expect(redScenario?.sourceSnapshot.boundary).toContain('no live OpenAPI call');
  });

  it('returns frozen presentation collections so judge-demo copy stays deterministic', () => {
    expect(Object.isFrozen(mofaOdaPresentation)).toBe(true);
    expect(Object.isFrozen(mofaOdaPresentation.scenarios)).toBe(true);
    expect(mofaOdaPresentation.scenarios.every(Object.isFrozen)).toBe(true);
  });
});
