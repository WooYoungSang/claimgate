import { describe, expect, it } from 'vitest';
import { attachAnchor, createExtractedClaim, type Claim } from '../../src/index.js';
import { evaluateRisk, RiskEngineError, assertRuleTrace } from '../../src/risk/index.js';

const now = () => '2026-07-07T00:00:00.000Z';
const actor = { kind: 'system' as const, id: 'fixture-anchorer' };

function extracted(id: string, aiValue: string | number = '10'): Claim {
  return createExtractedClaim({ id, text: `Claim ${id}`, aiValue, now });
}

function anchored(id: string, aiValue: string | number, sourceValue: string | number): Claim {
  return attachAnchor(extracted(id, aiValue), {
    anchor: { kind: 'dataset-row', sourceId: 'src-1', dataset: 'fixture.csv', row: 1, column: 'value', excerpt: String(sourceValue) },
    sourceValue,
    actor,
    now
  });
}

describe('deterministic risk engine', () => {
  it('flags missing Source Anchor as red needs-evidence with a rule trace', () => {
    const result = evaluateRisk({ claim: extracted('missing-anchor') });

    expect(result).toMatchObject({ level: 'red', queueBucket: 'red', recommendedState: 'needs-evidence' });
    expect(result.trace).toEqual([
      expect.objectContaining({ ruleId: 'source-exists', level: 'red', recommendedState: 'needs-evidence' })
    ]);
  });

  it('flags value mismatch as red conflict without AI scoring', () => {
    const result = evaluateRisk({ claim: anchored('value-mismatch', 42, 41) });

    expect(result).toMatchObject({ level: 'red', queueBucket: 'red', recommendedState: 'conflict' });
    expect(result.trace.map((trace) => trace.ruleId)).toContain('value-match');
  });

  it('flags unit/date/entity/staleness mismatches as explainable yellow traces', () => {
    const result = evaluateRisk({
      claim: anchored('metadata-mismatch', 42, 42),
      facts: {
        aiUnit: 'USD',
        sourceUnit: 'EUR',
        aiDate: '2026-Q2',
        sourceDate: '2026-Q1',
        aiEntity: 'Agency A',
        sourceEntity: 'Agency B',
        sourcePublishedAt: '2025-01-01',
        reviewedAt: '2026-07-07',
        maxSourceAgeDays: 365
      }
    });

    expect(result).toMatchObject({ level: 'yellow', queueBucket: 'yellow', recommendedState: 'needs-evidence' });
    expect(result.trace.map((trace) => trace.ruleId)).toEqual(['unit-match', 'date-match', 'entity-match', 'staleness']);
  });

  it('separates aggregate-only claims into aggregate-only queue/state', () => {
    const result = evaluateRisk({ claim: anchored('aggregate', 10, 10), facts: { aggregateOnly: true } });

    expect(result).toMatchObject({ level: 'yellow', queueBucket: 'aggregate-only', recommendedState: 'aggregate-only' });
    expect(result.trace[0]).toMatchObject({ ruleId: 'aggregate-only', level: 'yellow' });
  });

  it('rejects AI-provided risk score authority and empty traces', () => {
    expect(() => evaluateRisk({ claim: anchored('ai-scored', 10, 10), facts: { aiRiskScore: 0.9 } })).toThrow(RiskEngineError);
    expect(() => evaluateRisk({ claim: anchored('ai-scored', 10, 10), facts: { aiRiskScore: 0.9 } })).toThrow(/AI/);
    expect(() => assertRuleTrace([])).toThrow(/rule trace/i);
  });

  it('is deterministic for identical input', () => {
    const input = { claim: anchored('stable', '10', '10'), facts: { sourcePublishedAt: '2026-07-01', reviewedAt: '2026-07-07' } };

    expect(evaluateRisk(input)).toEqual(evaluateRisk(input));
  });
});
