import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { civicDataPack } from '@claimgate/pack-civic-data';
import { healthDataPack } from '@claimgate/pack-health-data';
import { mofaOdaPack } from '@claimgate/pack-mofa-oda';
import { AI_CURATOR_FIXTURE_PIPELINE, GUIDED_DEMO_START, GUIDED_DEMO_STEPS } from './guided-demo.js';

describe('demo visible Korean localization', () => {
  it('declares Korean document metadata for assistive tools and browser chrome', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

    expect(html).toContain('<html lang="ko">');
    expect(html).toContain('<title>ClaimGate 외교부 ODA 검토 데모</title>');
  });

  it('publishes Korean display names and report titles for every selectable domain pack', () => {
    expect([civicDataPack.displayName, healthDataPack.displayName, mofaOdaPack.displayName]).toEqual([
      '시민 예산 데이터 팩',
      '보건 통계 데이터 팩',
      '외교부 ODA 공공데이터 팩'
    ]);
    expect([civicDataPack, healthDataPack, mofaOdaPack].map((pack) => pack.reportTemplates[0]?.title)).toEqual([
      '시민 예산 검토 요약',
      '보건 통계 검토 요약',
      '외교부 ODA 주장 검토 요약'
    ]);
  });

  it('keeps the guided demo copy Korean while preserving technical identifiers separately', () => {
    const visibleCopy = [
      GUIDED_DEMO_START.eyebrow,
      GUIDED_DEMO_START.title,
      GUIDED_DEMO_START.description,
      GUIDED_DEMO_START.primaryLabel,
      GUIDED_DEMO_START.secondaryLabel,
      AI_CURATOR_FIXTURE_PIPELINE.input,
      AI_CURATOR_FIXTURE_PIPELINE.process,
      AI_CURATOR_FIXTURE_PIPELINE.output,
      AI_CURATOR_FIXTURE_PIPELINE.authority,
      AI_CURATOR_FIXTURE_PIPELINE.boundary,
      ...GUIDED_DEMO_STEPS.flatMap((step) => [step.shortLabel, step.title, step.instruction])
    ];

    expect(visibleCopy.join('\n')).not.toMatch(/fixture|source anchor|evidence pack|guided judge demo|proposal-only/i);
    expect(visibleCopy.every((copy) => /[가-힣]/.test(copy))).toBe(true);
  });

  it('uses Korean titles, claims, subjects, and rule messages in every selectable fixture', () => {
    for (const pack of [civicDataPack, healthDataPack, mofaOdaPack]) {
      for (const fixture of pack.fixtures) {
        const decision = pack.riskRules.find((rule) => rule.id === fixture.expected.ruleId)?.evaluate({
          packId: pack.id,
          claim: fixture.claim,
          fixtureId: fixture.id
        });
        const visibleCopy = [fixture.title, fixture.claim.text, fixture.claim.subject ?? '', decision?.trace[0]?.message ?? ''];

        expect(visibleCopy.every((copy) => /[가-힣]/.test(copy))).toBe(true);
      }
    }
  });
});
