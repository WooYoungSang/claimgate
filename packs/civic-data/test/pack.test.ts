import { describe, expect, it } from 'vitest';
import { assertDomainPackConformance, runDomainPackConformance } from '@claimgate/conformance';
import { civicDataPack } from '../src/index.js';

describe('@claimgate/pack-civic-data', () => {
  it('passes DomainPack conformance with civic-specific red behavior', () => {
    const report = assertDomainPackConformance(civicDataPack);

    expect(report.passed).toBe(true);
    expect(report.fixtureResults.map((result) => result.decision.level)).toEqual(['red']);
    expect(civicDataPack.labels.claimPlural).toBe('예산 주장');
  });

  it('keeps civic judgment in pack-owned rule traces', () => {
    const report = runDomainPackConformance(civicDataPack);

    expect(report.fixtureResults[0]?.decision.trace[0]?.ruleId).toBe('civic.budget-variance');
  });
});
