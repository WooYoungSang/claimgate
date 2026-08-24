import { describe, expect, it } from 'vitest';
import { attachAnchor, createExtractedClaim, type Claim, type DomainPack } from '../../src/index.js';
import { buildRiskQueue, greenSamplingOptionsFromDomainPack, RiskEngineError } from '../../src/risk/index.js';

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

  it('does not invent a green sampling policy when the host provides no sampling rate or minimum', () => {
    const queue = buildRiskQueue([{ claim: anchored('green-only', 1, 1) }], { seed: 'default' });

    expect(queue.items).toEqual([]);
    expect(queue.summary).toMatchObject({ greenCount: 1, sampledGreenCount: 0, queuedForReviewCount: 0 });
  });

  it('samples greens only when the DomainPack or host supplies an explicit sampling policy', () => {
    const queue = buildRiskQueue(
      [{ claim: anchored('green-1', 1, 1) }, { claim: anchored('green-2', 2, 2) }, { claim: anchored('green-3', 3, 3) }],
      { greenSampleRate: 0, minGreenSampleCount: 1, seed: 'host-policy' }
    );

    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({ bucket: 'green', sampledForReview: true });
  });

  it('uses a DomainPack green sampling recommendation as explicit host-supplied options', () => {
    const pack = {
      greenSamplingPolicyRecommendation: {
        owner: 'domain-pack',
        greenSampleRate: 0,
        minGreenSampleCount: 1,
        seed: 'pack-policy',
        reason: 'Pack requires at least one green sample.'
      }
    } as const satisfies Pick<DomainPack, 'greenSamplingPolicyRecommendation'>;

    const queue = buildRiskQueue(
      [{ claim: anchored('green-pack-1', 1, 1) }, { claim: anchored('green-pack-2', 2, 2) }],
      greenSamplingOptionsFromDomainPack(pack)
    );

    expect(queue.summary).toMatchObject({ greenCount: 2, sampledGreenCount: 1, queuedForReviewCount: 1 });
    expect(queue.items[0]?.sampledForReview).toBe(true);
  });

  it('rejects invalid explicit green sampling policy values instead of silently under-sampling', () => {
    expect(() => buildRiskQueue([{ claim: anchored('green-invalid-rate', 1, 1) }], { greenSampleRate: Number.NaN })).toThrow(RiskEngineError);
    expect(() => buildRiskQueue([{ claim: anchored('green-invalid-min', 1, 1) }], { minGreenSampleCount: -1 })).toThrow(RiskEngineError);
  });
});
