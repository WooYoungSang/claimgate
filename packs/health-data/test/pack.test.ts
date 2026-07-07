import { describe, expect, it } from 'vitest';
import { assertDomainPackConformance, runDomainPackConformance } from '../../../packages/conformance/src/index.js';
import { healthDataPack } from '../src/index.js';

describe('@claimgate/pack-health-data', () => {
  it('passes DomainPack conformance with health-specific yellow behavior', () => {
    const report = assertDomainPackConformance(healthDataPack);

    expect(report.passed).toBe(true);
    expect(report.fixtureResults.map((result) => result.decision.level)).toEqual(['yellow']);
    expect(healthDataPack.labels.claimPlural).toBe('health statistic claims');
  });

  it('keeps health judgment in pack-owned rule traces', () => {
    const report = runDomainPackConformance(healthDataPack);

    expect(report.fixtureResults[0]?.decision.trace[0]?.ruleId).toBe('health.stale-rate-period');
  });
});
