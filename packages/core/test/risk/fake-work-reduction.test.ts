import { describe, expect, it } from 'vitest';
import { attachAnchor, createExtractedClaim, transitionClaim, type Claim, type Reviewer } from '../../src/index.js';
import { buildRiskQueue, calculateFakeWorkReduction, applyReviewerCorrection } from '../../src/risk/index.js';

const now = () => '2026-07-07T00:00:00.000Z';
const reviewer: Reviewer = { id: 'reviewer-1' };

function claim(id: string, aiValue: number, sourceValue: number): Claim {
  return attachAnchor(createExtractedClaim({ id, text: `Claim ${id}`, aiValue, now }), {
    anchor: { kind: 'dataset-row', sourceId: 'src-1', dataset: 'risk.csv', row: Number(id.replace(/\D/g, '')) || 1 },
    sourceValue,
    actor: { kind: 'system', id: 'fixture-anchorer' },
    now
  });
}

describe('fake-work reduction metric', () => {
  it('counts skipped reviews after green sampling cost and correction/rejection outcomes', () => {
    const inputs = [
      { claim: claim('red-1', 9, 10) },
      { claim: claim('yellow-1', 20, 20), facts: { aiUnit: 'USD', sourceUnit: 'EUR' } },
      { claim: claim('green-1', 1, 1) },
      { claim: claim('green-2', 2, 2) },
      { claim: claim('green-3', 3, 3) }
    ];
    const queue = buildRiskQueue(inputs, { greenSampleRate: 1 / 3, seed: 'metric' });
    const corrected = applyReviewerCorrection({ claim: inputs[0]!.claim, reviewer, correctedValue: 10, reason: 'Correct to source.', now });
    const rejected = transitionClaim(
      transitionClaim(inputs[1]!.claim, { to: 'needs-evidence', actor: { kind: 'system', id: 'risk-engine' }, now }),
      { to: 'rejected', reviewer, reason: 'Reviewer rejected unsupported claim.', now }
    );

    const stats = calculateFakeWorkReduction({ queue, reviewedClaims: [corrected, rejected] });

    expect(stats).toMatchObject({
      totalClaimCount: 5,
      focusedReviewCount: 3,
      sampledGreenCount: 1,
      skippedReviewCount: 2,
      correctedCount: 1,
      rejectedCount: 1,
      projectedClaimCount: 1,
      netAvoidedReviewCount: 2
    });
    expect(stats.fakeWorkReducedRatio).toBe(0.4);
  });

  it('does not overclaim negative savings', () => {
    const queue = buildRiskQueue([{ claim: claim('green-1', 1, 1) }], { greenSampleRate: 1, seed: 'all-sampled' });

    expect(calculateFakeWorkReduction({ queue }).netAvoidedReviewCount).toBe(0);
  });
});
