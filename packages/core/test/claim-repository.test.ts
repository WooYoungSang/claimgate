import { describe, expect, it } from 'vitest';
import {
  acceptSourceAnchor,
  applyTerminalReviewerDecision,
  claimReviewVersion,
  ClaimRepositoryConcurrencyError,
  createExtractedClaim,
  createInMemoryClaimRepository,
  transitionClaim,
  type Reviewer
} from '../src/index.js';

const now = () => '2026-08-17T00:00:00.000Z';
const reviewer: Reviewer = { id: 'reviewer-1' };

function reviewableClaim() {
  const extracted = createExtractedClaim({
    id: 'claim-1',
    text: 'Country A is safe.',
    aiValue: 'safe',
    now
  });
  const anchored = acceptSourceAnchor({
    claim: extracted,
    anchor: { kind: 'dataset-row', sourceId: 'source-1', dataset: 'safety.csv', row: 1, column: 'notice' },
    sourceValue: 'travel advisory',
    reviewer,
    reason: 'Reviewer accepted the source anchor for repository concurrency testing.',
    now
  });
  return transitionClaim(anchored, {
    to: 'conflict',
    actor: { kind: 'system', id: 'deterministic-risk-engine' },
    now
  });
}

describe('ClaimRepository concurrency contract', () => {
  it('stores snapshots with the append-only claim review version', () => {
    const claim = reviewableClaim();
    const repository = createInMemoryClaimRepository([claim]);

    expect(repository.get('claim-1')).toMatchObject({
      claim,
      version: claimReviewVersion(claim)
    });
  });

  it('accepts one terminal reviewer decision and rejects a stale competing save', () => {
    const base = reviewableClaim();
    const repository = createInMemoryClaimRepository([base]);
    const version = repository.get('claim-1')?.version;
    if (version === undefined) throw new Error('missing repository snapshot');

    const verified = applyTerminalReviewerDecision(base, {
      expectedVersion: version,
      to: 'verified',
      reviewer,
      now
    });
    repository.save({ claim: verified, expectedVersion: version });

    const staleCorrected = applyTerminalReviewerDecision(base, {
      expectedVersion: version,
      to: 'corrected',
      reviewer: { id: 'reviewer-2' },
      correction: { correctedValue: 'travel advisory', reason: 'Second reviewer attempted a correction.' },
      now
    });

    expect(() => repository.save({ claim: staleCorrected, expectedVersion: version })).toThrow(
      new ClaimRepositoryConcurrencyError('claim-1', version, claimReviewVersion(verified))
    );
    expect(repository.get('claim-1')?.claim.state).toBe('verified');
  });
});
