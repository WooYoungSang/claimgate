import { describe, expect, it } from 'vitest';
import { attachAnchor, createExtractedClaim, type Claim } from '../../src/index.js';
import { buildRiskQueue } from '../../src/risk/index.js';

const now = () => '2026-07-07T00:00:00.000Z';
const actor = { kind: 'system' as const, id: 'fixture-anchorer' };

function extracted(id: string, value: number): Claim {
  return createExtractedClaim({ id, text: `Claim ${id}`, aiValue: value, now });
}

function anchored(id: string, aiValue: number, sourceValue: number): Claim {
  return attachAnchor(extracted(id, aiValue), {
    anchor: { kind: 'dataset-row', sourceId: 'src-1', dataset: 'fixture.csv', row: Number(id.replace(/\D/g, '')) || 1 },
    sourceValue,
    actor,
    now
  });
}

describe('risk queue and green sampling', () => {
  it('orders red, yellow, aggregate-only, then sampled green items deterministically', () => {
    const queue = buildRiskQueue(
      [
        { claim: anchored('green-1', 1, 1) },
        { claim: extracted('red-no-anchor', 2) },
        { claim: anchored('yellow-unit', 3, 3), facts: { aiUnit: 'USD', sourceUnit: 'EUR' } },
        { claim: anchored('aggregate', 4, 4), facts: { aggregateOnly: true } },
        { claim: anchored('green-2', 5, 5) }
      ],
      { greenSampleRate: 0.5, seed: 'risk-seed' }
    );

    expect(queue.items.map((item) => [item.claim.id, item.bucket])).toEqual([
      ['red-no-anchor', 'red'],
      ['yellow-unit', 'yellow'],
      ['aggregate', 'aggregate-only'],
      ['green-1', 'green']
    ]);
    expect(queue.summary).toMatchObject({ redCount: 1, yellowCount: 1, aggregateOnlyCount: 1, greenCount: 2, sampledGreenCount: 1 });
  });

  it('samples at least one green by default when greens exist', () => {
    const queue = buildRiskQueue([{ claim: anchored('green-only', 1, 1) }], { seed: 'default' });

    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({ bucket: 'green', sampledForReview: true });
  });
});
