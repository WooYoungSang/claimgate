import { describe, expect, it } from 'vitest';
import { attachAnchor, createEvidencePack, createExtractedClaim, transitionClaim, type Claim, type Reviewer, type Source } from '../../src/index.js';
import { applyReviewerCorrection, applyRiskDisposition } from '../../src/risk/index.js';

const now = () => '2026-07-07T00:00:00.000Z';
const reviewer: Reviewer = { id: 'reviewer-1', displayName: 'Risk Reviewer' };
const source: Source = { id: 'src-1', kind: 'csv', title: 'Fixture CSV', locator: 'fixtures/risk.csv' };

function anchored(id: string, aiValue: string | number, sourceValue: string | number): Claim {
  return attachAnchor(createExtractedClaim({ id, text: `Claim ${id}`, aiValue, now }), {
    anchor: { kind: 'dataset-row', sourceId: source.id, dataset: 'risk.csv', row: 2, column: 'value', excerpt: String(sourceValue) },
    sourceValue,
    actor: { kind: 'system', id: 'fixture-anchorer' },
    now
  });
}

describe('risk correction workflow', () => {
  it('corrects a red claim through reviewer authority and updates Evidence Pack value', () => {
    const corrected = applyReviewerCorrection({
      claim: anchored('wrong-value', 'wrong', 'correct'),
      reviewer,
      correctedValue: 'correct',
      reason: 'Anchored source value is authoritative.',
      now
    });

    const pack = createEvidencePack({ id: 'risk-pack', title: 'Risk Pack', claims: [corrected], sources: [source], generatedAt: now() });

    expect(corrected).toMatchObject({ state: 'corrected', correction: { originalAiValue: 'wrong', correctedValue: 'correct', reviewerId: reviewer.id } });
    expect(pack.items).toHaveLength(1);
    expect(pack.items[0]).toMatchObject({ claimId: 'wrong-value', reviewerDecision: 'corrected', normalizedValue: 'correct' });
  });

  it('keeps ineligible risk states out of Evidence Pack until reviewer terminal decision', () => {
    const conflicted = applyRiskDisposition({ claim: anchored('conflict-only', 1, 2), recommendedState: 'conflict', now });
    const needsEvidence = transitionClaim(anchored('needs-evidence', 3, 3), { to: 'needs-evidence', actor: { kind: 'system', id: 'risk-engine' }, now });

    const pack = createEvidencePack({ id: 'risk-pack', title: 'Risk Pack', claims: [conflicted, needsEvidence], sources: [source], generatedAt: now() });

    expect(pack.items).toEqual([]);
  });
});
