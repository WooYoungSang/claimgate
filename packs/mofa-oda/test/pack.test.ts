import { describe, expect, it } from 'vitest';
import { assertDomainPackConformance, runDomainPackConformance } from '@claimgate/conformance';
import { mofaOdaPack } from '../src/index.js';

const expectedFixtures = [
  {
    id: 'mofa-country-safety-mismatch',
    sourceId: 'mofa-country-safety-information',
    sourceTitle: '외교부_국가별 안전정보',
    sourceUrl: 'https://www.data.go.kr/data/15000760/openapi.do',
    ruleId: 'mofa.country-safety-mismatch',
    level: 'red',
    recommendedState: 'conflict'
  },
  {
    id: 'koica-project-period-or-country-mismatch',
    sourceId: 'koica-country-cooperation-projects',
    sourceTitle: '한국국제협력단_국가별 협력사업',
    sourceUrl: 'https://www.data.go.kr/data/15099198/openapi.do?recommendDataYn=Y',
    ruleId: 'koica.project-period-or-country-mismatch',
    level: 'yellow',
    recommendedState: 'needs-evidence'
  },
  {
    id: 'oda-term-definition-match',
    sourceId: 'koica-oda-glossary',
    sourceTitle: '한국국제협력단_ODA 용어사전',
    sourceUrl: 'https://www.data.go.kr/data/15052909/fileData.do?recommendDataYn=Y',
    ruleId: 'oda.term-definition-match',
    level: 'green',
    recommendedState: 'needs-evidence'
  }
] as const;

describe('@claimgate/pack-mofa-oda', () => {
  it('publishes stable MOFA/KOICA fixture identities and expected outcomes', () => {
    expect(mofaOdaPack.packageName).toBe('@claimgate/pack-mofa-oda');
    expect(mofaOdaPack.fixtures).toHaveLength(3);
    expect(mofaOdaPack.greenSamplingPolicyRecommendation).toMatchObject({
      owner: 'domain-pack',
      minGreenSampleCount: 1
    });

    for (const expected of expectedFixtures) {
      const fixture = mofaOdaPack.fixtures.find((candidate) => candidate.id === expected.id);

      expect(fixture?.source).toMatchObject({
        id: expected.sourceId,
        title: expected.sourceTitle,
        locator: expected.sourceUrl,
        metadata: {
          portal: '공공데이터포털',
          accessMode: 'offline-fixture-only'
        }
      });
      expect(fixture?.claim.anchor.sourceId).toBe(expected.sourceId);
      expect(fixture?.expected).toEqual({
        ruleId: expected.ruleId,
        level: expected.level,
        recommendedState: expected.recommendedState
      });
    }
  });

  it('passes deterministic DomainPack conformance for red, yellow, and green fixtures', () => {
    const report = assertDomainPackConformance(mofaOdaPack);

    expect(report.passed).toBe(true);
    expect(report.fixtureResults.map((result) => result.decision.level)).toEqual(['red', 'yellow', 'green']);
    expect(report.fixtureResults.map((result) => result.decision.recommendedState)).toEqual([
      'conflict',
      'needs-evidence',
      'needs-evidence'
    ]);
  });

  it('keeps ODA judgment in pack-owned rule traces with anchored evidence refs', () => {
    const report = runDomainPackConformance(mofaOdaPack);

    expect(report.fixtureResults.map((result) => result.decision.trace[0]?.ruleId)).toEqual(
      expectedFixtures.map((fixture) => fixture.ruleId)
    );
    for (const result of report.fixtureResults) {
      expect(result.decision.trace[0]?.evidenceRef).toContain(result.fixtureId);
    }
  });

  it('keeps text-span anchors aligned with their localized excerpts', () => {
    const textSpanAnchors = mofaOdaPack.fixtures
      .map((fixture) => fixture.claim.anchor)
      .filter((anchor) => anchor.kind === 'text-span');

    for (const anchor of textSpanAnchors) {
      const excerpt = anchor.excerpt;
      expect(excerpt).toBeDefined();
      if (!excerpt) throw new Error('텍스트 범위 근거에는 발췌문이 필요합니다.');
      expect(anchor.endOffset - anchor.startOffset).toBe(excerpt.length);
    }
  });
});
