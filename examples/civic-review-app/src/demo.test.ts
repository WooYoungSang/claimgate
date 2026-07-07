import { describe, expect, it } from 'vitest';
import { formatDemo, runDemo } from './demo.js';

describe('example DomainPack composition', () => {
  it('can swap between two domain packs without changing core or UI', () => {
    const civic = runDemo('civic-data');
    const health = runDemo('health-data');

    expect(civic.packId).toBe('civic-data');
    expect(health.packId).toBe('health-data');
    expect(civic.riskLevel).toBe('red');
    expect(health.riskLevel).toBe('yellow');
    expect(civic.claimLabel).not.toBe(health.claimLabel);
  });

  it('prints deterministic pack-specific output', () => {
    expect(formatDemo(runDemo('civic-data'))).toContain('Civic Budget Review Summary');
    expect(formatDemo(runDemo('health-data'))).toContain('Health Statistic Review Summary');
  });
});
